import { error, fail } from '@sveltejs/kit';
import { getGuilds } from '$lib/server/guilds';
import { getOverviewGuild, getOverviewSettings } from '$lib/server/overview';
import { waitLabel } from '$lib/server/panel';
import { throttle, throttleMessage } from '$lib/server/ratelimit';
import { requireUser, sessionCookie } from '$lib/server/session';
import { createPriority, getPriorityRequestOptions } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

const maxReason = 500;
const maxMinutes = 1440;

export const load: PageServerLoad = async (event) => {
	const guildId = event.params.guildID;
	if (!/^\d{17,20}$/.test(guildId)) error(404, 'That server does not exist.');

	await requireUser(event.locals, event.url);

	const token = event.cookies.get(sessionCookie) ?? '';
	const guilds = await getGuilds(token, guildId);
	if (!guilds) error(502, 'Your servers are unavailable right now, try again shortly.');
	if (!guilds.some((entry) => entry.id === guildId)) error(404, 'That server does not exist.');

	const overview = await getOverviewSettings(guildId);
	if (!overview.enabled || !overview.panels.priorities) {
		error(404, 'This server does not take priority requests.');
	}

	const guild = await getOverviewGuild(guildId);
	if (!guild) error(404, 'That server does not exist.');

	const options = await getPriorityRequestOptions(token, guildId);
	if (!options) error(502, 'This server is unavailable right now, try again shortly.');
	if (!options.enabled) error(404, 'This server does not take priority requests.');

	return { guild, types: options.request_types };
};

export const actions: Actions = {
	default: async (event) => {
		const guildId = event.params.guildID;
		const token = event.cookies.get(sessionCookie);
		const user = await event.locals.session;
		if (!token || !user) {
			return fail(401, { field: '', message: 'Your session expired, sign in again.' });
		}

		const wait = throttle(`request:${token}:${guildId}`);
		if (wait) return fail(429, { field: '', message: throttleMessage(wait) });

		const guilds = await getGuilds(token, guildId);
		if (!guilds) {
			return fail(502, { field: '', message: 'This server is unavailable right now.' });
		}
		if (!guilds.some((entry) => entry.id === guildId)) {
			return fail(404, { field: '', message: 'That server does not exist.' });
		}

		const overview = await getOverviewSettings(guildId);
		const options = await getPriorityRequestOptions(token, guildId);
		if (!options) {
			return fail(502, { field: '', message: 'This server is unavailable right now.' });
		}
		if (!overview.enabled || !overview.panels.priorities || !options.enabled) {
			return fail(404, { field: '', message: 'This server does not take priority requests.' });
		}

		const form = await event.request.formData();
		const type = form.get('type')?.toString().trim() ?? '';
		const submitted = form.get('reason')?.toString().trim() ?? '';
		const minutes = Number(form.get('time'));

		const chosen = options.request_types.find((entry) => entry.name === type);
		if (!chosen) return fail(400, { field: 'type', message: 'Pick a request type.' });

		const reason = chosen.reason || submitted;
		if (reason.length < 2 || reason.length > maxReason) {
			return fail(400, {
				field: 'reason',
				message: `Give a reason between 2 and ${maxReason} characters.`
			});
		}
		if (!Number.isInteger(minutes) || minutes < 1 || minutes > maxMinutes) {
			return fail(400, {
				field: 'time',
				message: `Ask for between 1 and ${maxMinutes} minutes.`
			});
		}

		const outcome = await createPriority(token, guildId, { type, reason, time: minutes });

		if (outcome.status === 429) {
			const remaining = outcome.retryAfter ? ` Try again in ${waitLabel(outcome.retryAfter)}.` : '';
			return fail(429, { field: '', message: `${outcome.message}${remaining}` });
		}
		if (outcome.status !== 200) {
			return fail(outcome.status, { field: '', message: outcome.message });
		}

		return { submitted: true };
	}
};
