import { json } from '@sveltejs/kit';
import { authorizeGuild } from '$lib/server/dashboard';
import { getActiveSession } from '$lib/server/sessions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	return json({ active: await getActiveSession(token, guild.id) });
};
