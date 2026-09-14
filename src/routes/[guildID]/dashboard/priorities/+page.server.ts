import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import { getPriorities, payload, readPriorities, savePriorities } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export type { PrioritySettings, PriorityPreset, PriorityRequestType } from '$lib/settings';

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const settings = await getPriorities(token, guild.id);
	if (!settings) error(502, 'Your priority settings are unavailable right now, try again shortly.');

	return { settings };
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const settings = readPriorities(body);
		if (settings.presets.some((preset) => !preset.name.trim())) {
			return fail(400, { message: 'Every preset needs a name.' });
		}
		if (settings.request_types.some((request) => !request.name.trim())) {
			return fail(400, { message: 'Every request type needs a name.' });
		}

		const message = await savePriorities(token, guild.id, settings);
		if (message) return fail(502, { message });

		return { settings };
	}
};
