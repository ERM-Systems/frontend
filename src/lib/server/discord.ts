import { env } from '$env/dynamic/private';
import { TtlCache } from './cache';
import { noteUnauthorized } from './session';

export interface DiscordProfile {
	id: string;
	username: string;
	avatarUrl: string;
}

export interface BotProfile {
	username: string;
	avatarUrl: string;
	bannerUrl: string;
	verified: boolean;
}

export interface Role {
	id: string;
	name: string;
	color: number;
	position: number;
	iconUrl: string;
}

export interface Channel {
	id: string;
	name: string;
	type: number;
	position: number;
}

interface RawRole {
	ID?: string;
	Name?: string;
	Color?: number;
	Position?: number;
	Icon?: string;
}

interface RawChannel {
	ID?: string;
	Name?: string;
	Type?: number;
	Position?: number;
}

export const profileTtl = 3 * 24 * 60 * 60;

const missTtl = 5 * 60 * 1000;
const guildTtl = 10 * 60 * 1000;
const timeout = 5000;

const botProfileTtl = 30 * 60 * 1000;

const profiles = new TtlCache<DiscordProfile | null>(profileTtl * 1000);
const roles = new TtlCache<Role[]>(guildTtl);
const channels = new TtlCache<Channel[]>(guildTtl);
const botProfile = new TtlCache<BotProfile>(botProfileTtl);

export function avatarUrl(discordId: string, avatar: string): string {
	if (!avatar) return defaultAvatar(discordId);
	if (avatar.startsWith('http')) return avatar;

	const extension = avatar.startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${extension}?size=128`;
}

export function defaultAvatar(discordId: string): string {
	const index = Number((BigInt(discordId) >> 22n) % 6n);
	return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

async function fetchProfile(discordId: string): Promise<DiscordProfile | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}/Users/GetUserInfo/${discordId}`, {
			signal: AbortSignal.timeout(timeout)
		});
		if (!response.ok) {
			if (response.status === 404) profiles.set(discordId, null, missTtl);
			return null;
		}

		const body = (await response.json()) as { Username?: string; Avatar?: string };
		const profile: DiscordProfile = {
			id: discordId,
			username: body.Username ?? '',
			avatarUrl: avatarUrl(discordId, body.Avatar ?? '')
		};

		profiles.set(discordId, profile);
		return profile;
	} catch {
		return null;
	}
}

export async function getProfile(discordId: string): Promise<DiscordProfile | null> {
	const cached = profiles.get(discordId);
	if (cached !== undefined) return cached;

	const profile = await profiles.dedupe(discordId, () => fetchProfile(discordId));
	return profile ?? profiles.stale(discordId) ?? null;
}

export async function getBotProfile(): Promise<BotProfile | null> {
	const cached = botProfile.get('bot');
	if (cached) return cached;
	if (!env.VITE_INTERNAL_URL) return null;

	return botProfile.dedupe('bot', async () => {
		try {
			const response = await fetch(`${env.VITE_INTERNAL_URL}/Discord/BotProfile`, {
				signal: AbortSignal.timeout(timeout)
			});
			if (!response.ok) return botProfile.stale('bot') ?? null;

			const body = (await response.json()) as {
				username?: string;
				avatar_url?: string;
				banner_url?: string;
				verified?: boolean;
			};

			const value: BotProfile = {
				username: body.username ?? '',
				avatarUrl: body.avatar_url ?? '',
				bannerUrl: body.banner_url ?? '',
				verified: body.verified === true
			};

			botProfile.set('bot', value);
			return value;
		} catch {
			return botProfile.stale('bot') ?? null;
		}
	});
}

async function fetchGuildList<T>(
	token: string,
	guildId: string,
	path: string,
	read: (body: Record<string, unknown>) => T[]
): Promise<T[] | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}/${guildId}${path}`, {
			headers: { Authorization: token },
			signal: AbortSignal.timeout(timeout)
		});
		if (!response.ok) {
			noteUnauthorized(token, response.status);
			console.warn(`${path} responded ${response.status}: ${await response.text()}`);
			return null;
		}

		return read((await response.json()) as Record<string, unknown>);
	} catch (error) {
		console.warn(`${path} failed:`, error);
		return null;
	}
}

export async function getRoles(token: string, guildId: string): Promise<Role[] | null> {
	const cached = roles.get(guildId);
	if (cached) return cached;

	const list = await roles.dedupe(`roles:${guildId}`, async () => {
		const fetched = await fetchGuildList(token, guildId, '/GetServerRoles', (body) =>
			((body.Roles ?? []) as RawRole[])
				.filter((raw) => raw.ID && raw.ID !== guildId)
				.map((raw) => ({
					id: String(raw.ID),
					name: raw.Name ?? 'Unknown Role',
					color: raw.Color ?? 0,
					position: raw.Position ?? 0,
					iconUrl: raw.Icon
						? `https://cdn.discordapp.com/role-icons/${raw.ID}/${raw.Icon}.png?size=32`
						: ''
				}))
				.sort((a, b) => b.position - a.position)
		);

		if (fetched) roles.set(guildId, fetched);
		return fetched;
	});

	return list ?? roles.stale(guildId) ?? null;
}

export async function getChannels(token: string, guildId: string): Promise<Channel[] | null> {
	const cached = channels.get(guildId);
	if (cached) return cached;

	const list = await channels.dedupe(`channels:${guildId}`, async () => {
		const fetched = await fetchGuildList(token, guildId, '/GetServerChannels', (body) =>
			((body.Channels ?? []) as RawChannel[])
				.filter((raw) => raw.ID)
				.map((raw) => ({
					id: String(raw.ID),
					name: raw.Name ?? 'unknown',
					type: raw.Type ?? 0,
					position: raw.Position ?? 0
				}))
				.sort((a, b) => a.position - b.position)
		);

		if (fetched) channels.set(guildId, fetched);
		return fetched;
	});

	return list ?? channels.stale(guildId) ?? null;
}

export function dropGuildDiscord(guildId: string) {
	roles.delete(guildId);
	channels.delete(guildId);
}
