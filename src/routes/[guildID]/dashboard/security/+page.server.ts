import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import { bool, getSettings, group, id, ids, payload, saveSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export interface GameSecurity {
	enabled: boolean;
	channel: string;
	webhook_channel: string;
	role: string[];
}

function read(raw: Record<string, unknown>): GameSecurity {
	const security = group(raw, 'game_security');

	return {
		enabled: bool(security.enabled),
		channel: id(security.channel),
		webhook_channel: id(security.webhook_channel),
		role: ids(security.role)
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

		const settings = read({ game_security: body });
		const message = await saveSettings(token, guild.id, { game_security: settings }, 'security');
		if (message) return fail(502, { message });

		return { settings };
	}
};
