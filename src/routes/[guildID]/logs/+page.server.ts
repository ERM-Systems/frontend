import { error } from '@sveltejs/kit';
import { getMyModerations, getOverviewGuild, getOverviewSettings } from '$lib/server/overview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const guildId = params.guildID;
	if (!/^\d{17,20}$/.test(guildId)) error(404, 'That server does not exist.');

	const settings = await getOverviewSettings(guildId);
	if (!settings.panels.moderations) {
		error(404, 'This server does not let members view their own logs.');
	}

	const guild = await getOverviewGuild(guildId);
	if (!guild) error(404, 'That server does not exist.');

	const token = locals.token ?? '';
	const signedIn = !!token;

	return {
		guild,
		signedIn,
		record: signedIn ? await getMyModerations(token, guildId) : null
	};
};
