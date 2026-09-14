import { authorizeGuild } from '$lib/server/dashboard';
import { getPunishmentTypes } from '$lib/server/settings';
import { defaultPunishmentTypes } from '$lib/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const types = await getPunishmentTypes(token, guild.id);
	const names = (types ?? []).map((entry) => entry.name).filter(Boolean);

	return { types: [...new Set([...defaultPunishmentTypes, ...names])] };
};
