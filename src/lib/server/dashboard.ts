import { error, fail } from '@sveltejs/kit';
import type { ActionFailure, Cookies } from '@sveltejs/kit';
import { cachedGuilds, getGuilds, type Guild } from './guilds';
import { throttle, throttleMessage } from './ratelimit';
import { requireToken, sessionCookie } from './session';
import { getPermissions, manageKey, viewKey } from './permissions';

interface GuildEvent {
	cookies: Cookies;
	locals: App.Locals;
	params: Partial<Record<string, string>>;
	url: URL;
}

export interface GuildAccess {
	status: 'ok' | 'denied' | 'missing' | 'unavailable';
	guild: { id: string; name: string; iconUrl: string } | null;
	level: number;
	reviewer: boolean;
	mode: string;
	granted: Record<string, boolean>;
}

export function sectionOf(url: URL): string {
	return url.pathname.split('/')[3] ?? '';
}

function pending(guildId: string): Guild {
	return {
		id: guildId,
		name: '',
		iconUrl: '',
		bannerUrl: '',
		permissionLevel: 3,
		applicationAccess: false,
		overviewEnabled: true,
		pinned: false
	};
}

const managementRoutes = ['/dashboard/staff-management/manage-infractions'];

const administratorRoutes = [
	'/dashboard/sessions',
	'/dashboard/staff-management',
	'/dashboard/punishments/manage'
];

function routeAccess(url: URL): { reviewer: boolean; level: number } {
	if (url.pathname.endsWith('/dashboard')) return { reviewer: true, level: 2 };
	if (url.pathname.includes('/dashboard/applications')) return { reviewer: true, level: 3 };
	if (managementRoutes.some((route) => url.pathname.includes(route))) {
		return { reviewer: false, level: 3 };
	}
	if (administratorRoutes.some((route) => url.pathname.includes(route))) {
		return { reviewer: false, level: 2 };
	}

	return { reviewer: false, level: 3 };
}

function check(guilds: Guild[], guildId: string, url: URL, custom = false): Guild {
	const guild = guilds.find((entry) => entry.id === guildId);
	if (!guild) error(404, 'You do not have access to that server.');

	const { reviewer, level } = routeAccess(url);
	if (guild.permissionLevel < level && !(reviewer && guild.applicationAccess) && !custom) {
		error(403, 'Only management can change these settings.');
	}

	return guild;
}

export async function guildAccess(token: string, guildId: string, url: URL): Promise<GuildAccess> {
	const { reviewer, level } = routeAccess(url);

	const guilds = await getGuilds(token, guildId);
	const empty = { mode: 'default', granted: {} };
	if (!guilds) {
		return { status: 'unavailable', guild: null, level: 0, reviewer: false, ...empty };
	}

	const guild = guilds.find((entry) => entry.id === guildId);
	if (!guild) return { status: 'missing', guild: null, level: 0, reviewer: false, ...empty };

	const summary = { id: guild.id, name: guild.name, iconUrl: guild.iconUrl };
	const permissions = await getPermissions(token, guildId);
	const holder = {
		level: guild.permissionLevel,
		reviewer: guild.applicationAccess,
		mode: permissions.mode,
		granted: permissions.granted
	};

	const section = sectionOf(url);
	const custom = Boolean(permissions.granted[viewKey(section)]);

	if (guild.permissionLevel < level && !(reviewer && guild.applicationAccess) && !custom) {
		return { status: 'denied', guild: summary, ...holder };
	}

	return { status: 'ok', guild: summary, ...holder };
}

export async function authorizeGuild(event: GuildEvent): Promise<{ token: string; guild: Guild }> {
	requireToken(event.locals, event.url);

	const token = event.cookies.get(sessionCookie) ?? '';
	const guildId = event.params.guildID ?? '';
	if (!/^\d{17,20}$/.test(guildId)) error(404, 'You do not have access to that server.');

	const permissions = await getPermissions(token, guildId);
	const custom = Boolean(permissions.granted[viewKey(sectionOf(event.url))]);

	const cached = cachedGuilds(token);
	if (!cached) return { token, guild: pending(guildId) };

	const guilds = (await getGuilds(token, guildId)) ?? cached;
	return { token, guild: check(guilds, guildId, event.url, custom) };
}

export async function authorizeStrict(event: GuildEvent): Promise<{ token: string; guild: Guild }> {
	requireToken(event.locals, event.url);

	const token = event.cookies.get(sessionCookie) ?? '';
	const guilds = await getGuilds(token, event.params.guildID);
	if (!guilds) error(502, 'Your servers are unavailable right now, try again shortly.');

	const permissions = await getPermissions(token, event.params.guildID ?? '');
	const custom = Boolean(permissions.granted[viewKey(sectionOf(event.url))]);

	return { token, guild: check(guilds, event.params.guildID ?? '', event.url, custom) };
}

export async function authorizeAction(event: GuildEvent): Promise<{
	token: string;
	guild: Guild;
	limited: ActionFailure<{ message: string }> | null;
}> {
	requireToken(event.locals, event.url);

	const token = event.cookies.get(sessionCookie) ?? '';
	const guilds = await getGuilds(token, event.params.guildID);
	if (!guilds) error(502, 'Your servers are unavailable right now, try again shortly.');

	const permissions = await getPermissions(token, event.params.guildID ?? '');
	const custom = Boolean(permissions.granted[manageKey(sectionOf(event.url))]);

	const guild = check(guilds, event.params.guildID ?? '', event.url, custom);
	const wait = throttle(`action:${token}:${guild.id}`);

	return { token, guild, limited: wait ? fail(429, { message: throttleMessage(wait) }) : null };
}
