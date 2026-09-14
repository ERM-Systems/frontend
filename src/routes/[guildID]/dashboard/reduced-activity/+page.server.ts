import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import { bool, getSettings, group, id, ids, payload, saveSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export interface ReducedActivitySettings {
	enabled: boolean;
	channel: string;
	ra_role: string[];
}

function read(raw: Record<string, unknown>): ReducedActivitySettings {
	const staff = group(raw, 'staff_management');
	const reduced = group(raw, 'reduced_activity');

	return {
		enabled: 'enabled' in reduced ? bool(reduced.enabled) : bool(staff.enabled),
		channel: id(reduced.channel),
		ra_role: ids(staff.ra_role)
	};
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const raw = await getSettings(token, guild.id);
	if (!raw) error(502, 'Your server settings are unavailable right now, try again shortly.');

	return { settings: read(raw) };
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const settings = read({ staff_management: body, reduced_activity: body });

		const message = await saveSettings(
			token,
			guild.id,
			{
				staff_management: { ra_role: settings.ra_role },
				reduced_activity: { enabled: settings.enabled, channel: settings.channel }
			},
			'reduced-activity'
		);
		if (message) return fail(502, { message });

		return { settings };
	}
};
