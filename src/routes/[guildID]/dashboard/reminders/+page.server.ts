import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import {
	bool,
	getServerLink,
	getSettings,
	id,
	ids,
	num,
	payload,
	saveSettings,
	text
} from '$lib/server/settings';
import type { Reminder } from '$lib/settings';
import type { Actions, PageServerLoad } from './$types';

export type { Reminder } from '$lib/settings';

function integration(value: unknown): Reminder['integration'] {
	const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	const type = text(raw.type);

	if (type !== 'Message' && type !== 'Hint') return { type: '', content: '' };
	return { type, content: text(raw.content).slice(0, 200) };
}

function read(value: unknown): Reminder[] {
	const list = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

	return list
		.map((raw, index) => ({
			id: String(raw.id ?? '') || String(Date.now() + index),
			name: text(raw.name).slice(0, 50),
			message: text(raw.message).slice(0, 2000),
			channel: id(raw.channel),
			role: ids(raw.role),
			interval: Math.max(60, num(raw.interval, 3600)),
			lastTriggered: num(raw.lastTriggered),
			paused: bool(raw.paused),
			completion_ability: bool(raw.completion_ability),
			integration: integration(raw.integration)
		}))
		.filter((reminder) => reminder.name && reminder.message);
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const raw = await getSettings(token, guild.id);
	if (!raw) error(502, 'Your server settings are unavailable right now, try again shortly.');

	const link = await getServerLink(token, guild.id);

	return { settings: { reminders: read(raw.reminders) }, linked: link?.linked ?? false };
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const reminders = read(body.reminders);
		if (reminders.some((reminder) => !reminder.channel)) {
			return fail(400, { message: 'Every reminder needs a channel.' });
		}

		const stored = reminders.map(({ integration: entry, ...reminder }) =>
			entry.type ? { ...reminder, integration: entry } : reminder
		);

		const message = await saveSettings(token, guild.id, { reminders: stored }, 'reminders');
		if (message) return fail(502, { message });

		return { settings: { reminders } };
	}
};
