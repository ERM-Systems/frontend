import { env } from '$env/dynamic/private';
import { getAffiliates } from './affiliates';
import { revokeSession } from './session';
import { TtlCache } from './cache';

export interface Guild {
	id: string;
	name: string;
	iconUrl: string;
	bannerUrl: string;
	permissionLevel: number;
	applicationAccess: boolean;
	overviewEnabled: boolean;
	pinned: boolean;
}

interface RawGuild {
	ID?: string;
	Name?: string;
	IconURL?: string;
	Icon?: string;
	BannerURL?: string;
	Banner?: string;
	PermissionLevel?: number;
	ApplicationAccess?: boolean;
	OverviewEnabled?: boolean;
	Pinned?: boolean;
}

const ttl = 5 * 60_000;
const timeout = 15_000;
const forceTimeout = 30_000;
const cooldownSteps = [10_000, 15_000, 20_000, 30_000, 60_000];
const cooldownReset = 10 * 60_000;

const guilds = new TtlCache<Guild[]>(ttl);
const cooldowns = new TtlCache<{ until: number; step: number }>(cooldownReset);

export function cdn(kind: 'icons' | 'banners', id: string, hash: string, size: number): string {
	const extension = hash.startsWith('a_') ? 'gif' : 'webp';
	return `https://cdn.discordapp.com/${kind}/${id}/${hash}.${extension}?size=${size}`;
}

function asset(
	kind: 'icons' | 'banners',
	id: string,
	url: string | undefined,
	hash: string | undefined,
	size: number
): string {
	if (url?.startsWith('http') && !/\/\.(png|webp|gif|jpg)/.test(url)) return url;
	if (hash) return cdn(kind, id, hash, size);
	return '';
}

function normalize(raw: RawGuild): Guild {
	const id = raw.ID ?? '';

	return {
		id,
		name: raw.Name ?? 'Unknown Server',
		iconUrl: asset('icons', id, raw.IconURL, raw.Icon, 128),
		bannerUrl: asset('banners', id, raw.BannerURL, raw.Banner, 512),
		permissionLevel: raw.PermissionLevel ?? 0,
		applicationAccess: raw.ApplicationAccess ?? false,
		overviewEnabled: raw.OverviewEnabled !== false,
		pinned: raw.Pinned ?? false
	};
}

function order(a: Guild, b: Guild): number {
	if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
	return a.name.localeCompare(b.name);
}

async function fetchGuilds(token: string, force: boolean): Promise<Guild[] | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	const path = `/Users/${force ? 'ForceGuilds' : 'Guilds'}`;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}${path}`, {
			headers: { Authorization: token },
			signal: AbortSignal.timeout(force ? forceTimeout : timeout)
		});
		if (!response.ok) {
			console.warn(`${path} responded ${response.status}: ${await response.text()}`);
			if (response.status === 401 || response.status === 403) revokeSession(token);
			return force && response.status === 404 ? fetchGuilds(token, false) : null;
		}

		const affiliates = await getAffiliates();
		if (!affiliates) {
			console.warn(`${path} skipped, affiliates are unavailable`);
			return null;
		}

		const allowed = new Set(affiliates);
		const body = (await response.json()) as { Guilds?: RawGuild[] };
		const list = (body.Guilds ?? []).filter((raw) => raw.ID && allowed.has(raw.ID)).map(normalize);
		list.sort(order);

		guilds.set(token, list);
		return list;
	} catch (error) {
		console.warn(`${path} failed:`, error);
		return null;
	}
}

export function cachedGuilds(token: string): Guild[] | undefined {
	return guilds.get(token);
}

export async function getGuilds(token: string, guildId?: string): Promise<Guild[] | null> {
	const cached = guilds.get(token);
	if (cached && (!guildId || cached.some((entry) => entry.id === guildId))) return cached;

	const list = await guilds.dedupe(token, () => fetchGuilds(token, false));
	return list ?? guilds.stale(token) ?? null;
}

export async function pinGuild(token: string, guildId: string): Promise<boolean | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}/Users/PinGuild/${guildId}`, {
			method: 'POST',
			headers: { Authorization: token },
			signal: AbortSignal.timeout(timeout)
		});
		if (!response.ok) {
			console.warn(`/Users/PinGuild responded ${response.status}: ${await response.text()}`);
			if (response.status === 401 || response.status === 403) revokeSession(token);
			return null;
		}

		const body = (await response.json()) as { pinned?: boolean };
		const pinned = body.pinned ?? false;

		const guild = guilds.stale(token)?.find((entry) => entry.id === guildId);
		if (guild) guild.pinned = pinned;

		return pinned;
	} catch (error) {
		console.warn('/Users/PinGuild failed:', error);
		return null;
	}
}

export function refreshWait(token: string): number {
	const entry = cooldowns.get(token);
	return entry ? Math.max(0, entry.until - Date.now()) : 0;
}

export async function refreshGuilds(token: string): Promise<Guild[] | null> {
	const previous = cooldowns.get(token);
	const step = previous ? Math.min(previous.step + 1, cooldownSteps.length - 1) : 0;
	cooldowns.set(token, { until: Date.now() + cooldownSteps[step], step });

	return guilds.dedupe(`force:${token}`, () => fetchGuilds(token, true));
}
