import { fail } from '@sveltejs/kit';
import { getAffiliates } from '$lib/server/affiliates';
import { getGuilds, pinGuild, refreshGuilds, refreshWait } from '$lib/server/guilds';
import { throttle, throttleMessage } from '$lib/server/ratelimit';
import { requireToken, sessionCookie } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals, url }) => {
	const token = requireToken(locals, url);

	return {
		username: locals.session.then((user) => user?.username ?? ''),
		guilds: getGuilds(token),
		affiliates: getAffiliates(),
		wait: refreshWait(token)
	};
};

export const actions: Actions = {
	refresh: async ({ cookies }) => {
		const token = cookies.get(sessionCookie);
		if (!token) return fail(401, { message: 'Your session expired, sign in again.', wait: 0 });

		const wait = refreshWait(token);
		if (wait) {
			return fail(429, {
				message: `Already refreshed, try again in ${Math.ceil(wait / 1000)}s.`,
				wait
			});
		}

		const guilds = await refreshGuilds(token);
		if (!guilds) {
			return fail(502, {
				message: 'Could not reach Discord, try again shortly.',
				wait: refreshWait(token)
			});
		}

		return { refreshed: guilds.length, wait: refreshWait(token) };
	},

	pin: async ({ cookies, request }) => {
		const token = cookies.get(sessionCookie);
		if (!token) return fail(401, { message: 'Your session expired, sign in again.' });

		const wait = throttle(`pin:${token}`);
		if (wait) return fail(429, { message: throttleMessage(wait) });

		const id = String((await request.formData()).get('id') ?? '');
		if (!/^\d{17,20}$/.test(id)) return fail(400, { message: 'Unknown server.' });

		const pinned = await pinGuild(token, id);
		if (pinned === null) return fail(502, { message: 'Could not update the pin, try again.' });

		return { pinned };
	}
};
