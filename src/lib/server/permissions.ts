import { env } from '$env/dynamic/private';
import { TtlCache } from './cache';
import { revokeSession } from './session';

export interface ResolvedPermissions {
	mode: string;
	granted: Record<string, boolean>;
	level: number;
	resolved: boolean;
}

const ttl = 30_000;
const timeout = 10_000;

const resolved = new TtlCache<ResolvedPermissions>(ttl);

const fallback: ResolvedPermissions = { mode: 'default', granted: {}, level: 0, resolved: false };

export const managementLevel = 3;

export function viewKey(section: string): string {
	return `dashboard.${section}.view`;
}

export function manageKey(section: string): string {
	return `dashboard.${section}.manage`;
}

export function canView(permissions: ResolvedPermissions, section: string): boolean {
	if (!permissions.resolved) return true;
	if (permissions.level >= managementLevel) return true;
	return Boolean(permissions.granted[viewKey(section)]);
}

export function canManage(permissions: ResolvedPermissions, section: string): boolean {
	if (!permissions.resolved) return true;
	if (permissions.level >= managementLevel) return true;
	return Boolean(permissions.granted[manageKey(section)]);
}

export function grantsPanel(permissions: ResolvedPermissions, key: string): boolean {
	if (!permissions.resolved) return false;
	if (permissions.level >= managementLevel) return true;
	return Boolean(permissions.granted[key]);
}

export async function getPermissions(token: string, guildId: string): Promise<ResolvedPermissions> {
	if (!env.VITE_INTERNAL_URL || !token) return fallback;

	const key = `${token}:${guildId}`;
	const cached = resolved.get(key);
	if (cached) return cached;

	return resolved.dedupe(key, async () => {
		try {
			const response = await fetch(`${env.VITE_INTERNAL_URL}/${guildId}/permissions/me`, {
				headers: { Authorization: token },
				signal: AbortSignal.timeout(timeout)
			});

			if (response.status === 401) revokeSession(token);
			if (!response.ok) return resolved.stale(key) ?? fallback;

			const body = (await response.json().catch(() => ({}))) as {
				permissions?: Record<string, boolean>;
				mode?: string;
				level?: number;
			};

			const value: ResolvedPermissions = {
				mode: body.mode === 'custom' ? 'custom' : 'default',
				granted: body.permissions ?? {},
				level: Number(body.level) || 0,
				resolved: true
			};

			resolved.set(key, value);
			return value;
		} catch {
			return resolved.stale(key) ?? fallback;
		}
	});
}

export function forget(token: string, guildId: string) {
	resolved.delete(`${token}:${guildId}`);
}
