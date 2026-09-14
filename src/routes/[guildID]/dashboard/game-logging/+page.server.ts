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
	saveSettings
} from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export interface LogChannel {
	enabled: boolean;
	channel: string;
}

export interface StaffRequests {
	enabled: boolean;
	channel: string;
	mentioned_roles: string[];
	permission_level: number;
	cooldown: number;
	min_staff: number;
	max_staff: number;
}

export interface GameLogging {
	message: LogChannel;
	priority: LogChannel;
	sts: LogChannel;
	staff_requests: StaffRequests;
}

function channel(raw: Record<string, unknown>, key: string): LogChannel {
	const value = group(raw, key);
	return { enabled: bool(value.enabled), channel: id(value.channel) };
}

function read(raw: Record<string, unknown>): GameLogging {
	const logging = group(raw, 'game_logging');
	const requests = group(logging, 'staff_requests');

	return {
		message: channel(logging, 'message'),
		priority: channel(logging, 'priority'),
		sts: channel(logging, 'sts'),
		staff_requests: {
			enabled: bool(requests.enabled),
			channel: id(requests.channel),
			mentioned_roles: ids(requests.mentioned_roles),
			permission_level: Math.min(3, Math.max(0, num(requests.permission_level))),
			cooldown: Math.max(0, num(requests.cooldown)),
			min_staff: Math.max(0, num(requests.min_staff)),
			max_staff: Math.max(0, num(requests.max_staff))
		}
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

		const settings = read({ game_logging: body });
		const message = await saveSettings(token, guild.id, { game_logging: settings }, 'game-logging');
		if (message) return fail(502, { message });

		return { settings };
	}
};
