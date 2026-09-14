import { fail } from '@sveltejs/kit';
import { getGuilds } from '$lib/server/guilds';
import { throttle, throttleMessage } from '$lib/server/ratelimit';
import { requireToken, sessionCookie } from '$lib/server/session';
import {
	assignWhitelabelSpot,
	getUserWhitelabel,
	unassignWhitelabelSpot
} from '$lib/server/whitelabel';
import type { Actions, PageServerLoad } from './$types';

export type { WhitelabelSpot, WhitelabelSpots } from '$lib/server/whitelabel';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	requireToken(locals, url);
	const token = cookies.get(sessionCookie) ?? '';

	const [spots, guilds] = await Promise.all([getUserWhitelabel(token), getGuilds(token)]);

	return {
		spots,
		servers: (guilds ?? [])
			.filter((guild) => guild.permissionLevel >= 3)
			.map((guild) => ({ id: guild.id, name: guild.name, iconUrl: guild.iconUrl }))
	};
};

export const actions: Actions = {
	assign: async ({ cookies, request }) => {
		const token = cookies.get(sessionCookie);
		if (!token) return fail(401, { message: 'Your session expired, sign in again.' });

		const wait = throttle(`whitelabel:${token}`);
		if (wait) return fail(429, { message: throttleMessage(wait) });

		const form = await request.formData();
		const spotId = String(form.get('spotId') ?? '');
		const guildId = String(form.get('guildId') ?? '');
		if (!spotId || !/^\d{17,20}$/.test(guildId)) {
			return fail(400, { message: 'Pick a server to assign this spot to.' });
		}

		const message = await assignWhitelabelSpot(token, spotId, guildId);
		if (message) return fail(400, { message });

		return { assigned: true };
	},

	unassign: async ({ cookies, request }) => {
		const token = cookies.get(sessionCookie);
		if (!token) return fail(401, { message: 'Your session expired, sign in again.' });

		const wait = throttle(`whitelabel:${token}`);
		if (wait) return fail(429, { message: throttleMessage(wait) });

		const spotId = String((await request.formData()).get('spotId') ?? '');
		if (!spotId) return fail(400, { message: 'Unknown whitelabel spot.' });

		const message = await unassignWhitelabelSpot(token, spotId);
		if (message) return fail(400, { message });

		return { unassigned: true };
	}
};
