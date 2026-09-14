import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import { dropOverviewSettings, readOverview } from '$lib/server/overview';
import { getSettings, group, payload, saveSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const raw = await getSettings(token, guild.id);
	if (!raw) error(502, 'Your server settings are unavailable right now, try again shortly.');

	return {
		settings: readOverview(group(raw, 'server_overview')),
		publicUrl: `${event.url.origin}/${guild.id}/server`
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const settings = readOverview(body);
		const message = await saveSettings(
			token,
			guild.id,
			{ server_overview: settings },
			'server-overview'
		);
		if (message) return fail(502, { message });

		dropOverviewSettings(guild.id);
		return { settings };
	}
};
