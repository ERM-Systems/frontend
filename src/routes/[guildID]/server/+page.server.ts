import { error } from '@sveltejs/kit';
import { getOverviewGuild, getOverviewSettings, overviewLive } from '$lib/server/overview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const guildId = params.guildID;
	if (!/^\d{17,20}$/.test(guildId)) error(404, 'That server does not exist.');

	const settings = await getOverviewSettings(guildId);
	if (!settings.enabled) error(404, 'This server has not made its overview public.');

	const guild = await getOverviewGuild(guildId);
	if (!guild) error(404, 'That server does not exist.');

	return {
		guild,
		settings,
		live: await overviewLive(guildId, settings)
	};
};
