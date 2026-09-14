import { error, json } from '@sveltejs/kit';
import { getMyModerations, getOverviewSettings } from '$lib/server/overview';
import { throttle, throttleMessage } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const guildId = params.guildID;
	if (!/^\d{17,20}$/.test(guildId)) error(404, 'That server does not exist.');

	const token = locals.token;
	if (!token) error(401, 'Sign in to see your record.');

	const wait = throttle(`record:${token}:${guildId}`);
	if (wait) return json({ message: throttleMessage(wait) }, { status: 429 });

	const settings = await getOverviewSettings(guildId);
	if (!settings.enabled || !settings.panels.moderations) {
		error(404, 'This server does not share moderation records.');
	}

	const record = await getMyModerations(token, guildId);
	if (!record) error(502, 'Your record is unavailable right now, try again shortly.');

	return json(record);
};
