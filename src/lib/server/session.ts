import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { redirect, type Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { TtlCache } from './cache';

export const sessionCookie = env.ENVIRONMENT === 'staging' ? 'authTokenStaging' : 'authToken';
export const returnCookie = 'authReturn';
export const sessionMaxAge = 30 * 24 * 60 * 60;
export const afterLogin = '/guilds';

export interface SessionUser {
	id: string;
	discordId: string;
	username: string;
	avatar: string;
}

interface CachedSession {
	user: SessionUser;
	checkedAt: number;
}

const ttl = 3 * 24 * 60 * 60 * 1000;
const revalidateAfter = 15 * 60 * 1000;
const timeout = 5000;

const cacheDir = '.cache';
const cacheFile = `${cacheDir}/.session-cache.json`;
const flushInterval = 30 * 1000;

const sessions = new TtlCache<CachedSession>(ttl);
const revoked = new TtlCache<true>(ttl);
const terminated = new TtlCache<true>(ttl);
const stored = new Map<string, CachedSession>();

let dirty = false;

function restore() {
	let entries: Record<string, CachedSession>;
	try {
		entries = JSON.parse(readFileSync(cacheFile, 'utf8'));
	} catch {
		return;
	}

	const cutoff = Date.now() - ttl;
	for (const [token, session] of Object.entries(entries)) {
		if (!session?.user?.discordId || session.checkedAt <= cutoff) continue;
		sessions.set(token, session);
		stored.set(token, session);
	}
}

function persist() {
	if (!dirty) return;
	dirty = false;

	const cutoff = Date.now() - ttl;
	for (const [token, session] of stored) {
		if (session.checkedAt <= cutoff) stored.delete(token);
	}

	try {
		mkdirSync(cacheDir, { recursive: true });
		writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(stored)), { mode: 0o600 });
	} catch (cause) {
		console.warn('Session cache could not be written:', cause);
	}
}

function remember(token: string, session: CachedSession) {
	stored.set(token, session);
	dirty = true;
}

function forget(token: string) {
	if (stored.delete(token)) dirty = true;
}

restore();
setInterval(persist, flushInterval).unref();

async function fetchSession(
	token: string
): Promise<CachedSession | 'invalid' | 'terminated' | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	let response: Response;
	try {
		response = await fetch(`${env.VITE_INTERNAL_URL}/Users/Session`, {
			headers: { Authorization: token },
			signal: AbortSignal.timeout(timeout)
		});
	} catch (error) {
		console.warn('/Users/Session failed:', error);
		return null;
	}

	if (response.status === 403) {
		const body = await response.json().catch(() => null);
		if (body?.Terminated) {
			terminated.set(token, true);
			dropSession(token);
			return 'terminated';
		}
	}
	if (response.status === 401 || response.status === 403 || response.status === 404) {
		revokeSession(token);
		return 'invalid';
	}
	if (!response.ok) {
		console.warn(`/Users/Session responded ${response.status}: ${await response.text()}`);
		return null;
	}

	let body: { User?: { ID?: string; DiscordID?: string; Username?: string; Avatar?: string } };
	try {
		body = await response.json();
	} catch (error) {
		console.warn('/Users/Session returned unreadable JSON:', error);
		return null;
	}

	const user = body.User;
	if (!user?.DiscordID) {
		console.warn('/Users/Session returned no user:', JSON.stringify(body));
		return null;
	}

	const session: CachedSession = {
		user: {
			id: user.ID ?? '',
			discordId: user.DiscordID,
			username: user.Username ?? '',
			avatar: user.Avatar ?? ''
		},
		checkedAt: Date.now()
	};

	sessions.set(token, session);
	remember(token, session);
	return session;
}

function revalidate(token: string) {
	void sessions.dedupe(token, () => fetchSession(token)).catch(() => null);
}

export async function getSession(
	token: string
): Promise<SessionUser | 'invalid' | 'terminated' | null> {
	if (revoked.get(token)) return 'invalid';
	if (terminated.get(token)) return 'terminated';

	const cached = sessions.get(token);
	if (cached) {
		if (Date.now() - cached.checkedAt > revalidateAfter) revalidate(token);
		return cached.user;
	}

	const result = await sessions.dedupe(token, () => fetchSession(token));
	if (result === 'invalid') return 'invalid';
	if (result === 'terminated') return 'terminated';
	if (result) return result.user;

	return sessions.stale(token)?.user ?? null;
}

export function safeReturnTo(path: string | null | undefined): string {
	if (!path || !path.startsWith('/')) return afterLogin;
	if (path.startsWith('//') || path.startsWith('/\\')) return afterLogin;
	return path;
}

function loginRedirect(url: URL): never {
	redirect(303, `/login?returnTo=${encodeURIComponent(url.pathname)}`);
}

export function requireToken(locals: App.Locals, url: URL): string {
	if (!locals.token) loginRedirect(url);
	return locals.token;
}

export async function requireUser(locals: App.Locals, url: URL): Promise<SessionUser> {
	if (!locals.token) loginRedirect(url);

	const user = await locals.session;
	if (!user) loginRedirect(url);

	return user;
}

export function dropSession(token: string) {
	sessions.delete(token);
	forget(token);
}

export function revokeSession(token: string) {
	sessions.delete(token);
	forget(token);
	revoked.set(token, true);
}

export function isRevoked(token: string): boolean {
	return revoked.get(token) === true;
}

export function isStaleStatus(status: number): boolean {
	return status === 401;
}

export function noteUnauthorized(token: string, status: number): boolean {
	if (!token || !isStaleStatus(status)) return false;

	revokeSession(token);
	return true;
}

export function sessionCookieScopes({ hostname }: URL): Parameters<Cookies['delete']>[1][] {
	if (/^(localhost|[\d.]+|\[.+])$/.test(hostname)) return [{ path: '/' }];

	return [{ path: '/' }, { path: '/', domain: hostname.split('.').slice(-2).join('.') }];
}

export function clearSessionCookie(cookies: Cookies, url: URL) {
	for (const scope of sessionCookieScopes(url)) cookies.delete(sessionCookie, scope);
}
