import { error, json } from '@sveltejs/kit';
import { getGuilds } from '$lib/server/guilds';
import { sessionCookie } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(sessionCookie);
	if (!token) error(401, 'not signed in');

	const guilds = await getGuilds(token);
	if (!guilds) error(502, 'failed to fetch your servers');

	return json(guilds);
};
