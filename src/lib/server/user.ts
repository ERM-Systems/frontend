import { env } from '$env/dynamic/private';
import type { DailyActivity, Stats } from '$lib/stats';
import { avatarUrl } from './discord';
import { revokeSession } from './session';
import { TtlCache } from './cache';

export interface Preferences {
	ModView: boolean;
	ShiftView: boolean;
	StaffView: boolean;
	ERLCView: boolean;
	LogView: boolean;
	AutomaticShifts: boolean;
	ShiftReports: boolean;
	Punishments: boolean;
	AIPredictions: boolean;
	CompactMode: boolean;
}

export interface RobloxAccount {
	id: string;
	username: string;
	thumbnailUrl: string;
}

export interface Profile {
	username: string;
	avatarUrl: string;
}

export const preferenceKeys: (keyof Preferences)[] = [
	'ModView',
	'ShiftView',
	'StaffView',
	'ERLCView',
	'LogView',
	'AutomaticShifts',
	'ShiftReports',
	'Punishments',
	'AIPredictions',
	'CompactMode'
];

const defaults: Preferences = {
	ModView: true,
	ShiftView: true,
	StaffView: true,
	ERLCView: true,
	LogView: true,
	AutomaticShifts: false,
	ShiftReports: false,
	Punishments: false,
	AIPredictions: false,
	CompactMode: false
};

const ttl = 60_000;
const timeout = 10_000;

const stats = new TtlCache<Stats>(ttl);

async function call(token: string, path: string, method = 'GET', body?: unknown) {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}${path}`, {
			method,
			headers: {
				Authorization: token,
				...(body === undefined ? {} : { 'content-type': 'application/json' })
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(timeout)
		});
		if (!response.ok) {
			console.warn(`${path} responded ${response.status}: ${await response.text()}`);
			if (response.status === 401 || response.status === 403) revokeSession(token);
			return null;
		}

		return (await response.json()) as Record<string, unknown>;
	} catch (error) {
		console.warn(`${path} failed:`, error);
		return null;
	}
}

export async function getPreferences(token: string): Promise<Preferences | null> {
	const body = await call(token, '/Users/Preferences');
	if (!body) return null;

	const preferences = { ...defaults };
	for (const key of preferenceKeys) preferences[key] = Boolean(body[key] ?? defaults[key]);

	return preferences;
}

export async function savePreferences(token: string, preferences: Preferences): Promise<boolean> {
	return (await call(token, '/Users/Preferences', 'POST', preferences)) !== null;
}

export async function getStats(
	token: string,
	window: { days?: number; year?: number } = {}
): Promise<Stats | null> {
	const query = window.year ? `year=${window.year}` : `days=${window.days ?? 30}`;
	const key = `${token}:${query}`;

	const cached = stats.get(key);
	if (cached) return cached;

	return stats.dedupe(key, async () => {
		const body = await call(token, `/Users/Stats?${query}`);
		if (!body) return stats.stale(key) ?? null;

		const value: Stats = {
			days: Number(body.days ?? 0),
			earliest: Number(body.earliest ?? 0),
			shifts: Number(body.shifts ?? 0),
			onDutySeconds: Math.max(0, Number(body.on_duty_seconds ?? 0)),
			longestShift: Math.max(0, Number(body.longest_shift ?? 0)),
			averageShift: Math.max(0, Number(body.average_shift ?? 0)),
			moderations: Number(body.moderations ?? 0),
			moderationsByType: (body.moderations_by_type as Record<string, number>) ?? {},
			guilds: Number(body.guilds ?? 0),
			daily: (body.daily as Record<string, DailyActivity>) ?? {}
		};

		stats.set(key, value);
		return value;
	});
}

export async function getRoblox(token: string): Promise<RobloxAccount | null> {
	const body = await call(token, '/Users/Roblox');
	if (!body?.Username) return null;

	return {
		id: String(body.RobloxID ?? ''),
		username: String(body.Username),
		thumbnailUrl: String(body.ThumbnailURL ?? '')
	};
}

export async function endSession(token: string): Promise<boolean> {
	return (await call(token, '/Auth/Logout', 'POST')) !== null;
}

export async function unlinkRoblox(token: string): Promise<boolean> {
	return (await call(token, '/Users/Roblox', 'DELETE')) !== null;
}

export async function refreshProfile(token: string, discordId: string): Promise<Profile | null> {
	const body = await call(token, '/Users/RefreshProfile', 'POST');
	if (!body) return null;

	return {
		username: String(body.Username ?? ''),
		avatarUrl: avatarUrl(discordId, String(body.Avatar ?? ''))
	};
}
