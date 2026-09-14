import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import {
	bool,
	getSettings,
	group,
	id,
	ids,
	num,
	payload,
	saveSettings,
	text
} from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export interface StatisticsChannel {
	channel: string;
	format: string;
}

export interface GameAutomation {
	permission_sync: {
		enabled: boolean;
		moderator_roles: string[];
		administrator_roles: string[];
	};
	discord_checks: {
		enabled: boolean;
		channel_id: string;
		kick_after: number;
		message: string;
	};
	statistics: StatisticsChannel[];
}

const roleLimit = 25;
const maximumWarnings = 10;

function list(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function keyed(value: unknown): Record<string, unknown> {
	const entries = list(value)
		.map((entry) => ({ channel: id(entry.channel), format: entry.format }))
		.filter((entry) => entry.channel);

	return Object.fromEntries(entries.map((entry) => [entry.channel, { format: entry.format }]));
}

function read(raw: Record<string, unknown>): GameAutomation {
	const erlc = group(raw, 'ERLC');
	const sync = group(erlc, 'permission_sync');
	const checks = group(erlc, 'discord_checks');
	const statistics = group(erlc, 'statistics');

	return {
		permission_sync: {
			enabled: bool(sync.enabled),
			moderator_roles: ids(sync.moderator_roles).slice(0, roleLimit),
			administrator_roles: ids(sync.administrator_roles).slice(0, roleLimit)
		},
		discord_checks: {
			enabled: bool(checks.enabled),
			channel_id: id(checks.channel_id),
			kick_after: Math.min(maximumWarnings, Math.max(0, num(checks.kick_after))),
			message: text(checks.message).replace(/\s+/g, ' ').trim().slice(0, 500)
		},
		statistics: Object.keys(statistics)
			.map((channel) => ({
				channel: id(channel),
				format: text(group(statistics, channel).format).slice(0, 100)
			}))
			.filter((entry) => entry.channel && entry.format)
	};
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const raw = await getSettings(token, guild.id);
	if (!raw) error(502, 'Your server settings are unavailable right now, try again shortly.');

	return { settings: read(raw) };
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const chosen = list(body.statistics)
			.map((entry) => id(entry.channel))
			.filter(Boolean);
		if (new Set(chosen).size !== chosen.length) {
			return fail(400, { message: 'Each statistics channel can only be listed once.' });
		}

		const settings = read({ ERLC: { ...body, statistics: keyed(body.statistics) } });

		const message = await saveSettings(token, guild.id, {
			ERLC: {
				permission_sync: settings.permission_sync,
				discord_checks: {
					...settings.discord_checks,
					channel_id: settings.discord_checks.channel_id || 0
				},
				statistics: Object.fromEntries(
					settings.statistics.map((entry) => [entry.channel, { format: entry.format }])
				)
			}
		});
		if (message) return fail(502, { message });

		return { settings };
	}
};
