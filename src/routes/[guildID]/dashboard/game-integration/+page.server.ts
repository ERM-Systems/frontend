import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import {
	bool,
	generateWebhookToken,
	getHistoricLogs,
	getRollbackPremortem,
	getRollbackProgress,
	getServerInformation,
	getServerLink,
	getSettings,
	group,
	id,
	ids,
	num,
	payload,
	previewServerKey,
	saveSettings,
	startRollback,
	webhookUrl,
	setServerKey,
	text
} from '$lib/server/settings';
import { getWeather } from '$lib/server/weather';
import type { Actions, PageServerLoad } from './$types';

export type { Weather } from '$lib/server/weather';
export type {
	HistoricLog,
	RollbackAction,
	RollbackProgress,
	RollbackStatus
} from '$lib/server/settings';

import {
	ingameActions,
	ingamePermissionLevels,
	teamNames,
	type IngameAction,
	type IngamePermissionLevel
} from '$lib/settings';

export interface VoiceTarget {
	argument: string;
	channel: string;
}

export interface IngamePermission {
	enabled: boolean;
	level: IngamePermissionLevel;
	roles: string[];
}

export interface IngameCommand {
	trigger: string;
	action: IngameAction;
	channel: string;
	roles: string[];
	pm_target: 'caller' | 'argument';
	permission: IngamePermission;
	message: string;
	voice_channels: VoiceTarget[];
}

export interface TeamRestriction {
	required_roles: string[];
	load_player: boolean;
	warn_player: boolean;
	warning_message: string;
	notification_channel: string;
	mentioned_roles: string[];
	kick_after_infractions: number;
}

export interface GameIntegration {
	elevation_required: boolean;
	message_on_warning: boolean;
	auto_punish: boolean;
	allow_player_refresh: boolean;
	kill_logs: string;
	player_logs: string;
	rdm_channel: string;
	rdm_mentionables: string[];
	rdm_threshold: number;
	rdm_window: number;
	welcome_message: string;
	unrealistic_items_whitelist: number[];
	automatic_shifts: { enabled: boolean; shift_type: string };
	remote_commands: { webhook_channel: string };
	kick_timer: { enabled: boolean; time: number; punishment: string };
	weather: { sync_time: boolean; sync_weather: boolean; location: string };
	avatar_check: {
		enabled: boolean;
		channel: string;
		mentioned_roles: string[];
		message: string;
		blacklisted_items: number[];
	};
	unrealistic_username_check: { channel: string; mentioned_roles: string[] };
	vehicle_restrictions: {
		enabled: boolean;
		channel: string;
		roles: string[];
		cars: string[];
		message: string;
	};
	team_restrictions: Record<string, TeamRestriction>;
	team_restrictions_enabled: boolean;
	team_restrictions_min_players: number;
	ingame_commands: { commands: IngameCommand[] };
	webhook: {
		command_log_channel: string;
	};
}

function strings(value: unknown): string[] {
	return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : [];
}

function numbers(value: unknown): number[] {
	return Array.isArray(value) ? value.map((entry) => num(entry)).filter((entry) => entry > 0) : [];
}

function voiceTargets(value: unknown): VoiceTarget[] {
	if (!Array.isArray(value)) return [];

	return value
		.map((entry) => (entry ?? {}) as Record<string, unknown>)
		.map((entry) => ({ argument: text(entry.argument).slice(0, 32), channel: id(entry.channel) }))
		.filter((entry) => entry.argument && entry.channel)
		.slice(0, 10);
}

function ingamePermission(raw: Record<string, unknown>): IngamePermission {
	const level = text(raw.level) as IngamePermissionLevel;

	return {
		enabled: bool(raw.enabled),
		level: ingamePermissionLevels.includes(level) ? level : 'staff',
		roles: ids(raw.roles).slice(0, 10)
	};
}

function ingameCommand(raw: Record<string, unknown>): IngameCommand {
	const action = text(raw.action) as IngameAction;

	return {
		trigger: text(raw.trigger)
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, '')
			.slice(0, 32),
		action: ingameActions.includes(action) ? action : 'send_message',
		channel: id(raw.channel),
		roles: ids(raw.roles).slice(0, 5),
		pm_target: text(raw.pm_target) === 'argument' ? 'argument' : 'caller',
		permission: ingamePermission(group(raw, 'permission')),
		message: text(raw.message).slice(0, 500),
		voice_channels: voiceTargets(raw.voice_channels)
	};
}

function ingameCommands(value: unknown): IngameCommand[] {
	if (!Array.isArray(value)) return [];

	const seen = new Set<string>();
	const commands: IngameCommand[] = [];

	for (const entry of value) {
		const command = ingameCommand((entry ?? {}) as Record<string, unknown>);
		if (!command.trigger || seen.has(command.trigger)) continue;

		seen.add(command.trigger);
		commands.push(command);
		if (commands.length === 25) break;
	}

	return commands;
}

function team(raw: Record<string, unknown>): TeamRestriction {
	return {
		required_roles: ids(raw.required_roles),
		load_player: bool(raw.load_player),
		warn_player: bool(raw.warn_player),
		warning_message: text(raw.warning_message).slice(0, 500),
		notification_channel: id(raw.notification_channel),
		mentioned_roles: ids(raw.mentioned_roles),
		kick_after_infractions: Math.max(0, num(raw.kick_after_infractions))
	};
}

function read(raw: Record<string, unknown>): GameIntegration {
	const erlc = group(raw, 'ERLC');
	const shifts = group(erlc, 'automatic_shifts');
	const remote = group(erlc, 'remote_commands');
	const timer = group(erlc, 'kick_timer');
	const weather = group(erlc, 'weather');
	const avatar = group(erlc, 'avatar_check');
	const username = group(erlc, 'unrealistic_username_check');
	const vehicles = group(erlc, 'vehicle_restrictions');
	const teams = group(erlc, 'team_restrictions');
	const ingame = group(erlc, 'ingame_commands');
	const webhook = group(raw, 'webhook');

	return {
		elevation_required: bool(erlc.elevation_required),
		message_on_warning: bool(erlc.message_on_warning),
		auto_punish: bool(erlc.auto_punish),
		allow_player_refresh: bool(erlc.allow_player_refresh),
		kill_logs: id(erlc.kill_logs),
		player_logs: id(erlc.player_logs),
		rdm_channel: id(erlc.rdm_channel),
		rdm_mentionables: ids(erlc.rdm_mentionables),
		rdm_threshold: Math.max(2, num(erlc.rdm_threshold) || 4),
		rdm_window: Math.max(5, num(erlc.rdm_window) || 20),
		welcome_message: text(erlc.welcome_message).slice(0, 500),
		unrealistic_items_whitelist: numbers(erlc.unrealistic_items_whitelist),
		automatic_shifts: {
			enabled: bool(shifts.enabled),
			shift_type: text(shifts.shift_type).slice(0, 32)
		},
		remote_commands: { webhook_channel: id(remote.webhook_channel) },
		kick_timer: {
			enabled: bool(timer.enabled),
			time: Math.max(0, num(timer.time, 1800)),
			punishment: text(timer.punishment) === 'ban' ? 'ban' : 'kick'
		},
		weather: {
			sync_time: bool(weather.sync_time),
			sync_weather: bool(weather.sync_weather),
			location: text(weather.location).slice(0, 64)
		},
		avatar_check: {
			enabled: bool(avatar.enabled),
			channel: id(avatar.channel),
			mentioned_roles: ids(avatar.mentioned_roles),
			message: text(avatar.message).slice(0, 500),
			blacklisted_items: numbers(avatar.blacklisted_items)
		},
		unrealistic_username_check: {
			channel: id(username.channel),
			mentioned_roles: ids(username.mentioned_roles)
		},
		vehicle_restrictions: {
			enabled: bool(vehicles.enabled),
			channel: id(vehicles.channel),
			roles: ids(vehicles.roles),
			cars: strings(vehicles.cars),
			message: text(vehicles.message).slice(0, 500)
		},
		ingame_commands: { commands: ingameCommands(ingame.commands) },
		team_restrictions: Object.fromEntries(
			teamNames.map((name) => [name, team(group(teams, name))])
		),
		team_restrictions_enabled: bool(erlc.team_restrictions_enabled),
		team_restrictions_min_players: Math.max(0, num(erlc.team_restrictions_min_players)),
		webhook: {
			command_log_channel: id(webhook.command_log_channel)
		}
	};
}

function rollbackTarget(form: FormData): { time: number; omit: string[] } {
	return {
		time: Math.max(0, Math.floor(num(form.get('time')))),
		omit: String(form.get('omit') ?? '')
			.split(',')
			.map((entry) =>
				entry
					.trim()
					.toLowerCase()
					.replace(/[^a-z]/g, '')
			)
			.filter(Boolean)
			.slice(0, 10)
	};
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const raw = await getSettings(token, guild.id);
	if (!raw) error(502, 'Your server settings are unavailable right now, try again shortly.');

	const link = await getServerLink(token, guild.id);

	const hook = group(raw, 'webhook');
	const types = group(raw, 'shift_types');

	const settings = read(raw);

	return {
		settings,
		shiftTypes: (Array.isArray(types.types) ? (types.types as Record<string, unknown>[]) : [])
			.map((type) => text(type.name).slice(0, 32))
			.filter(Boolean),
		webhookUrl: webhookUrl(text(hook.token)),
		lastEvent: num(hook.last_event_ts),
		link,
		server: link?.linked ? getServerInformation(token, guild.id) : Promise.resolve(null),
		weather: getWeather(settings.weather.location)
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const settings = read({
			ERLC: body,
			webhook: body.webhook
		});

		const syncing = settings.weather.sync_time || settings.weather.sync_weather;
		if (syncing && !(await getWeather(settings.weather.location))) {
			return fail(400, {
				message: 'That location could not be found, pick one that validates first.'
			});
		}

		const { webhook: hook, ...erlc } = settings;
		const message = await saveSettings(
			token,
			guild.id,
			{
				ERLC: {
					...erlc,
					remote_commands: { webhook_channel: erlc.remote_commands.webhook_channel || 0 }
				},
				webhook: hook
			},
			'game-integration'
		);
		if (message) return fail(502, { message });

		return { settings };
	},

	location: async (event) => {
		const { limited } = await authorizeAction(event);
		if (limited) return limited;

		const location = String((await event.request.formData()).get('location') ?? '').trim();
		if (!location) return fail(400, { message: 'Enter a location first.' });

		const weather = await getWeather(location.slice(0, 64));
		if (!weather) return fail(400, { message: 'No place matched that, try a city name.' });

		return { weather };
	},

	webhook: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const generated = await generateWebhookToken(token, guild.id);
		if (!generated) return fail(502, { message: 'Could not generate a webhook token.' });

		return { webhookUrl: webhookUrl(generated) };
	},

	check: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const serverKey = String((await event.request.formData()).get('serverKey') ?? '').trim();
		if (serverKey.length < 8) {
			return fail(400, { message: 'That does not look like a server key.' });
		}

		const result = await previewServerKey(token, guild.id, serverKey);
		if ('message' in result) return fail(502, { message: result.message });

		return { server: result.server };
	},

	key: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const serverKey = String((await event.request.formData()).get('serverKey') ?? '').trim();
		if (serverKey.length < 8)
			return fail(400, { message: 'That does not look like a server key.' });

		const message = await setServerKey(token, guild.id, serverKey);
		if (message) return fail(502, { message });

		return { linked: true, server: await getServerInformation(token, guild.id) };
	},

	logs: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const logs = await getHistoricLogs(token, guild.id);
		if (!logs) return fail(502, { message: 'Could not load your command history, try again.' });

		return { logs };
	},

	premortem: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const { time, omit } = rollbackTarget(await event.request.formData());
		if (!time) return fail(400, { message: 'Pick a point in your command history first.' });

		const actions = await getRollbackPremortem(token, guild.id, time, omit);
		if (!actions) return fail(502, { message: 'Could not work out what would be reversed.' });

		return { actions };
	},

	rollback: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const { time, omit } = rollbackTarget(await event.request.formData());
		if (!time) return fail(400, { message: 'Pick a point in your command history first.' });

		const started = await startRollback(token, guild.id, time, omit);
		if (typeof started === 'string') return fail(502, { message: started });

		return { progress: started };
	},

	progress: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const progress = await getRollbackProgress(token, guild.id);
		if (!progress) return fail(502, { message: 'Could not read the rollback progress.' });

		return { progress };
	}
};
