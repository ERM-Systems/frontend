import { getChannels, getRoles } from '$lib/server/discord';
import { authorizeGuild, guildAccess } from '$lib/server/dashboard';
import { getGuilds } from '$lib/server/guilds';
import { bool, getSettings, group, ids } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

export type { Channel, Role } from '$lib/server/discord';
export type { GuildAccess } from '$lib/server/dashboard';

export const load: LayoutServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);
	const raw = await getSettings(token, guild.id);
	const onboarding = raw ? group(raw, 'onboarding') : {};
	const staff = raw ? group(raw, 'staff_management') : {};

	return {
		setupPending:
			Boolean(raw) &&
			!bool(onboarding.completed) &&
			!(ids(staff.role).length > 0 && ids(staff.management_role).length > 0),
		guild: { id: guild.id, name: guild.name, iconUrl: guild.iconUrl },
		access: guildAccess(token, guild.id, event.url),
		roles: getRoles(token, guild.id),
		channels: getChannels(token, guild.id),
		guilds: getGuilds(token)
	};
};
