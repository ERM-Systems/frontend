import { error } from '@sveltejs/kit';
import { authorizePanel } from '$lib/server/panel';
import { getUserInfractions } from '$lib/server/staff';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const access = await authorizePanel(event);

	const infractions = await getUserInfractions(access.token, access.guildId, access.discordId);
	if (!infractions) error(502, 'Your infractions are unavailable right now, try again shortly.');

	return { guild: access.guild, infractions };
};
