import { json } from '@sveltejs/kit';
import { authorizeGuild } from '$lib/server/dashboard';
import { dropGuildDiscord } from '$lib/server/discord';
import { throttle, throttleMessage } from '$lib/server/ratelimit';
import { dropGuildSettings } from '$lib/server/settings';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const wait = throttle(`resync:${token}:${guild.id}`);
	if (wait) {
		return json({ message: throttleMessage(wait) }, { status: 429 });
	}

	dropGuildDiscord(guild.id);
	dropGuildSettings(guild.id);

	return json({ refreshed: guild.id });
};
