import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { avatarUrl } from '$lib/server/discord';
import { throttle, throttleMessage } from '$lib/server/ratelimit';
import { dropSession, isRevoked, requireUser, sessionCookie } from '$lib/server/session';
import {
	getPreferences,
	getRoblox,
	getStats,
	preferenceKeys,
	refreshProfile,
	savePreferences,
	unlinkRoblox,
	type Preferences
} from '$lib/server/user';
import type { Actions, PageServerLoad } from './$types';

export type { Preferences } from '$lib/server/user';
export type { Stats } from '$lib/stats';

export const load: PageServerLoad = async ({ cookies, depends, locals, url }) => {
	depends('app:profile');

	const user = await requireUser(locals, url);
	const token = cookies.get(sessionCookie) ?? '';

	const preferences = await getPreferences(token);
	if (isRevoked(token)) redirect(303, `/login?returnTo=${encodeURIComponent(url.pathname)}`);

	return {
		profile: {
			username: user.username,
			discordId: user.discordId,
			avatarUrl: avatarUrl(user.discordId, user.avatar)
		},
		preferences,
		staging: env.ENVIRONMENT === 'staging',
		affiliates: env.ENVIRONMENT === 'affiliates',
		stats: getStats(token, { days: 365 }),
		roblox: getRoblox(token)
	};
};

export const actions: Actions = {
	refresh: async ({ cookies, locals }) => {
		const token = cookies.get(sessionCookie);
		const user = await locals.session;
		if (!token || !user) return fail(401, { message: 'Your session expired, sign in again.' });

		const wait = throttle(`profile:${token}`);
		if (wait) return fail(429, { message: throttleMessage(wait) });

		const profile = await refreshProfile(token, user.discordId);
		if (!profile) return fail(502, { message: 'Could not reach Discord, try again shortly.' });

		dropSession(token);
		return { profile };
	},

	unlink: async ({ cookies }) => {
		const token = cookies.get(sessionCookie);
		if (!token) return fail(401, { message: 'Your session expired, sign in again.' });

		const wait = throttle(`unlink:${token}`);
		if (wait) return fail(429, { message: throttleMessage(wait) });

		if (!(await unlinkRoblox(token))) {
			return fail(502, { message: 'Could not unlink your ROBLOX account, try again.' });
		}

		return { unlinked: true };
	},

	preferences: async ({ cookies, request }) => {
		const token = cookies.get(sessionCookie);
		if (!token) return fail(401, { message: 'Your session expired, sign in again.' });

		const wait = throttle(`preferences:${token}`);
		if (wait) return fail(429, { message: throttleMessage(wait) });

		const form = await request.formData();
		const preferences = Object.fromEntries(
			preferenceKeys.map((key) => [key, form.get(key) === 'on'])
		) as unknown as Preferences;

		if (!(await savePreferences(token, preferences))) {
			return fail(502, { message: 'Could not save your preferences, try again.' });
		}

		const stored = await getPreferences(token);
		if (!stored)
			return fail(502, { message: 'Saved, but your preferences could not be read back.' });

		return { preferences: stored };
	}
};
