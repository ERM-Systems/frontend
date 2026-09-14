import { allVisible, layoutKey, paneIds, paneViewKeys, parseLayout, type Views } from '$lib/panel';
import { authorizePanel, getOptions, getSnapshot } from '$lib/server/panel';
import { grantsPanel } from '$lib/server/permissions';
import { getPreferences } from '$lib/server/user';
import type { PageServerLoad } from './$types';

export type { Moderation, Priority, Shift, Snapshot, StaffRequest } from '$lib/server/panel';

export const load: PageServerLoad = async (event) => {
	const access = await authorizePanel(event);
	const preferences = await getPreferences(access.token);

	const views: Views = allVisible();
	if (preferences) {
		for (const id of paneIds) views[id] = preferences[paneViewKeys[id]];
	}

	return {
		layout: parseLayout(event.cookies.get(layoutKey)),
		views,
		guild: access.guild,
		level: access.level,
		canBan: access.level >= 2 || grantsPanel(access.permissions, 'panel.player.ban'),
		discordId: access.discordId,
		snapshot: getSnapshot(access.token, access.guildId, access.discordId),
		options: getOptions(access.token, access.guildId, Math.max(access.level, 1))
	};
};
