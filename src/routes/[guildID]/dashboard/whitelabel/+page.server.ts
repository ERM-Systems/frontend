import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import { getBotProfile } from '$lib/server/discord';
import { payload } from '$lib/server/settings';
import { getWhitelabel, saveWhitelabel } from '$lib/server/whitelabel';
import { validWhitelabel, type WhitelabelSettings } from '$lib/settings';
import type { Actions, PageServerLoad } from './$types';

export type { WhitelabelSettings } from '$lib/settings';

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const [result, botProfile] = await Promise.all([getWhitelabel(token, guild.id), getBotProfile()]);

	if (result.status !== 'ok' || !result.whitelabel) {
		error(502, 'Your whitelabel settings are unavailable right now, try again shortly.');
	}

	return { whitelabel: result.whitelabel, active: result.active, botProfile };
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const settings: WhitelabelSettings = {
			botName: String(body.botName ?? '').trim(),
			avatarUrl: String(body.avatarUrl ?? '').trim(),
			bannerUrl: String(body.bannerUrl ?? '').trim(),
			bio: String(body.bio ?? '').trim()
		};

		if (!validWhitelabel(settings)) {
			return fail(400, {
				message: 'Check the bot name, bio and image links are within their limits.'
			});
		}

		const message = await saveWhitelabel(token, guild.id, settings);
		if (message) return fail(502, { message });

		return { settings };
	}
};
