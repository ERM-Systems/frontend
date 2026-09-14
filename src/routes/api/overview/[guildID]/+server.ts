import { error, json } from '@sveltejs/kit';
import { getOverviewSettings, overviewLive } from '$lib/server/overview';
import { throttle, throttleMessage } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, getClientAddress }) => {
	const guildId = params.guildID;
	if (!/^\d{17,20}$/.test(guildId)) error(404, 'That server does not exist.');

	const wait = throttle(`overview:${getClientAddress()}:${guildId}`);
	if (wait) return json({ message: throttleMessage(wait) }, { status: 429 });

	const settings = await getOverviewSettings(guildId);
	if (!settings.enabled) error(404, 'This server has not made its overview public.');

	return json(await overviewLive(guildId, settings));
};
