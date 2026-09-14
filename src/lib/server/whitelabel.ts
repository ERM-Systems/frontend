import { env } from '$env/dynamic/private';
import type { WhitelabelSettings } from '$lib/settings';
import { revokeSession } from './session';

interface Reply {
	ok: boolean;
	status: number;
	body: Record<string, unknown>;
}

const timeout = 10_000;

export interface WhitelabelResult {
	status: 'ok' | 'unavailable';
	active: boolean;
	whitelabel: WhitelabelSettings | null;
}

export interface WhitelabelSpot {
	id: string;
	expiry: number;
	guildId: string;
	guildName: string;
	active: boolean;
}

export interface WhitelabelSpots {
	spots: WhitelabelSpot[];
	total: number;
	used: number;
	available: number;
}

async function request(
	token: string,
	path: string,
	method = 'GET',
	payload?: unknown
): Promise<Reply | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}${path}`, {
			method,
			headers: {
				Authorization: token,
				...(payload === undefined ? {} : { 'content-type': 'application/json' })
			},
			body: payload === undefined ? undefined : JSON.stringify(payload),
			signal: AbortSignal.timeout(timeout)
		});

		const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
		if (!response.ok) {
			console.warn(`${path} responded ${response.status}: ${JSON.stringify(body)}`);
			if (response.status === 401) revokeSession(token);
		}

		return { ok: response.ok, status: response.status, body };
	} catch (error) {
		console.warn(`${path} failed:`, error);
		return null;
	}
}

function call(
	token: string,
	guildId: string,
	path: string,
	method = 'GET',
	payload?: unknown
): Promise<Reply | null> {
	return request(token, `/${guildId}${path}`, method, payload);
}

function reason(reply: Reply | null, fallback: string): string {
	const message = reply?.body.message;
	return typeof message === 'string' && message ? message : fallback;
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(raw: Record<string, unknown>): WhitelabelSettings {
	return {
		botName: text(raw.bot_name),
		avatarUrl: text(raw.avatar_url),
		bannerUrl: text(raw.banner_url),
		bio: text(raw.bio)
	};
}

export async function getWhitelabel(token: string, guildId: string): Promise<WhitelabelResult> {
	const reply = await call(token, guildId, '/panel/whitelabel');
	if (!reply?.ok) return { status: 'unavailable', active: false, whitelabel: null };

	return {
		status: 'ok',
		active: reply.body.active === true,
		whitelabel: normalize(reply.body)
	};
}

export async function saveWhitelabel(
	token: string,
	guildId: string,
	settings: WhitelabelSettings
): Promise<string | null> {
	const reply = await call(token, guildId, '/panel/whitelabel', 'PUT', {
		bot_name: settings.botName,
		avatar_url: settings.avatarUrl,
		banner_url: settings.bannerUrl,
		bio: settings.bio
	});
	if (!reply?.ok) return reason(reply, 'Could not save your whitelabel settings, try again.');

	return null;
}

function normalizeSpot(raw: Record<string, unknown>): WhitelabelSpot {
	return {
		id: text(raw.id),
		expiry: num(raw.expiry),
		guildId: text(raw.guild_id),
		guildName: text(raw.guild_name),
		active: raw.active === true
	};
}

export async function getUserWhitelabel(token: string): Promise<WhitelabelSpots | null> {
	const reply = await request(token, '/Users/Whitelabel');
	if (!reply?.ok) return null;

	const list = Array.isArray(reply.body.spots)
		? (reply.body.spots as Record<string, unknown>[])
		: [];
	return {
		spots: list.map(normalizeSpot),
		total: num(reply.body.total),
		used: num(reply.body.used),
		available: num(reply.body.available)
	};
}

export async function assignWhitelabelSpot(
	token: string,
	spotId: string,
	guildId: string
): Promise<string | null> {
	const reply = await request(token, '/Users/Whitelabel/Assign', 'POST', {
		spot_id: spotId,
		guild_id: guildId
	});
	if (!reply?.ok) return reason(reply, 'Could not assign that whitelabel spot, try again.');

	return null;
}

export async function unassignWhitelabelSpot(
	token: string,
	spotId: string
): Promise<string | null> {
	const reply = await request(token, '/Users/Whitelabel/Unassign', 'POST', { spot_id: spotId });
	if (!reply?.ok) return reason(reply, 'Could not unassign that whitelabel spot, try again.');

	return null;
}
