import { env } from '$env/dynamic/private';
import { revokeSession } from './session';
import { TtlCache } from './cache';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
	id: string;
	time: string;
	content: string;
	type: NotificationType;
	read: boolean;
	global: boolean;
	application: { guildId: string; applicationId: string } | null;
}

interface RawNotification {
	id?: string;
	content?: string;
	time?: string;
	type?: string;
	discordId?: string;
	read?: boolean;
	guildId?: string;
	applicationId?: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function target(raw: RawNotification): { guildId: string; applicationId: string } | null {
	const guildId = String(raw.guildId ?? '');
	const applicationId = String(raw.applicationId ?? '');
	if (!/^\d{17,20}$/.test(guildId) || !uuid.test(applicationId)) return null;

	return { guildId, applicationId };
}

const types: NotificationType[] = ['info', 'success', 'warning', 'error'];
const ttl = 30_000;
const timeout = 10_000;

const cache = new TtlCache<Notification[]>(ttl);

function normalize(raw: RawNotification): Notification {
	const type = (raw.type ?? '') as NotificationType;

	return {
		id: String(raw.id ?? '') || (raw.time ?? ''),
		time: raw.time ?? '',
		content: raw.content ?? '',
		type: types.includes(type) ? type : 'info',
		read: raw.read ?? false,
		global: raw.discordId === '0',
		application: target(raw)
	};
}

async function call(token: string, path: string, method: string): Promise<Response | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}${path}`, {
			method,
			headers: { Authorization: token },
			signal: AbortSignal.timeout(timeout)
		});
		if (!response.ok) {
			console.warn(`${path} responded ${response.status}: ${await response.text()}`);
			if (response.status === 401 || response.status === 403) revokeSession(token);
			return null;
		}

		return response;
	} catch (error) {
		console.warn(`${path} failed:`, error);
		return null;
	}
}

async function fetchNotifications(token: string): Promise<Notification[]> {
	const response = await call(token, '/Users/Notifications', 'GET');
	if (!response) return cache.stale(token) ?? [];

	const body = (await response.json()) as { notifications?: RawNotification[] };
	const list = (body.notifications ?? []).filter((raw) => raw.time).map(normalize);

	cache.set(token, list);
	return list;
}

export function getNotifications(token: string): Promise<Notification[]> {
	if (!token || !env.VITE_INTERNAL_URL) return Promise.resolve([]);

	const cached = cache.get(token);
	if (cached) return Promise.resolve(cached);

	return cache.dedupe(token, () => fetchNotifications(token));
}

export async function markRead(token: string, id: string | null): Promise<boolean> {
	const path = id ? `/Users/Notifications/${id}/Read` : '/Users/Notifications/ReadAll';
	const response = await call(token, path, 'PUT');

	cache.delete(token);
	return response !== null;
}

export async function clear(token: string, id: string | null): Promise<boolean> {
	const path = id ? `/Users/Notifications/${id}` : '/Users/Notifications/All';
	const response = await call(token, path, 'DELETE');

	cache.delete(token);
	return response !== null;
}
