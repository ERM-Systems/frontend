import { error, json } from '@sveltejs/kit';
import {
	authorizePanel,
	call,
	getModerationDetail,
	getModerationPage,
	getProfile,
	getSnapshot,
	loadDiscordCheck,
	loadVehicleRestrictions,
	recordRemote,
	cachedLogs,
	refreshLogs,
	searchRoblox,
	type PanelAccess
} from '$lib/server/panel';
import { grantsPanel } from '$lib/server/permissions';
import { panelPermissionKey } from '$lib/permissions';
import { refreshable, request, type Section } from '$lib/server/panelStream';
import { throttle, throttleMessage } from '$lib/server/ratelimit';
import { getPreferences, preferenceKeys, savePreferences } from '$lib/server/user';
import type { RequestHandler } from './$types';

type Body = Record<string, unknown>;

interface Command {
	level?: number;
	run: (access: PanelAccess, body: Body) => Promise<Response>;
}

const managementLevel = 3;
const punishmentLevel = 2;

function str(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function day(value: string | null, offset = 0): number {
	const parsed = Date.parse(`${(value ?? '').trim()}T00:00:00Z`);
	return Number.isFinite(parsed) ? Math.floor(parsed / 1000) + offset * 86_400 : 0;
}

function ok(message: string, data: unknown = null) {
	return json({ ok: true, message, data });
}

function bad(message: string, status = 400) {
	return json({ ok: false, message, data: null }, { status });
}

const embedded = /\{[\s\S]*}/;

function readable(message: string): string {
	const match = message.match(embedded);

	if (match) {
		try {
			const body = JSON.parse(match[0]) as { message?: unknown };

			return typeof body.message === 'string' ? body.message.trim() : '';
		} catch {
			return '';
		}
	}

	return message.includes('non-200 status code') ? '' : message;
}

async function forward(
	access: PanelAccess,
	path: string,
	init: RequestInit,
	success: string
): Promise<Response> {
	const reply = await call(access.token, path, init);
	if (!reply) return bad('The bot is not responding right now, try again shortly.', 502);

	if (reply.status !== 200) {
		const message = readable(str(reply.body.message) || str(reply.body.Message));
		return bad(message || 'That action failed.', reply.status === 429 ? 429 : 400);
	}

	return ok(success, reply.body);
}

const playerCommands: Record<
	string,
	{ path: string; label: string; byId?: boolean; level?: number }
> = {
	bring: { path: 'BringPlayer', label: 'Player brought to you.' },
	teleport: { path: 'TeleportPlayer', label: 'Teleported to the player.' },
	kick: { path: 'KickPlayer', label: 'Player kicked.' },
	ban: { path: 'BanPlayer', label: 'Player banned.', byId: true, level: punishmentLevel },
	jail: { path: 'JailPlayer', label: 'Player jailed.' },
	unjail: { path: 'UnjailPlayer', label: 'Player released.' },
	wanted: { path: 'WantedPlayer', label: 'Player marked wanted.' },
	unwanted: { path: 'UnwantedPlayer', label: 'Wanted status cleared.' },
	heal: { path: 'HealPlayer', label: 'Player healed.' },
	kill: { path: 'KillPlayer', label: 'Player killed.' },
	respawn: { path: 'RespawnPlayer', label: 'Player respawned.' },
	refresh: { path: 'RefreshPlayer', label: 'Player refreshed.' }
};

const commands: Record<string, Command> = {
	'stream.refresh': {
		run: (access, body) => {
			const wanted = Array.isArray(body.sections)
				? (body.sections.filter((entry) => refreshable.includes(entry as Section)) as Section[])
				: refreshable;

			return Promise.resolve(
				request(access.guildId, wanted)
					? ok('Refreshing.')
					: bad('The live feed is not connected.', 409)
			);
		}
	},

	'shift.start': {
		run: (access, body) => {
			const type = str(body.type);
			if (!type) return Promise.resolve(bad('Pick a shift type first.'));

			return forward(
				access,
				`/${access.guildId}/StartShift`,
				{ method: 'POST', body: JSON.stringify({ type }) },
				'Shift started.'
			);
		}
	},

	'shift.end': {
		run: (access, body) => {
			const id = str(body.id);
			if (!id) return Promise.resolve(bad('No active shift to end.'));

			return forward(
				access,
				`/${access.guildId}/EndShift?ID=${encodeURIComponent(id)}`,
				{ method: 'POST' },
				'Shift ended.'
			);
		}
	},

	'shift.break': {
		run: (access, body) => {
			const id = str(body.id);
			if (!id) return Promise.resolve(bad('No active shift to pause.'));

			return forward(
				access,
				`/${access.guildId}/ToggleBreak?ID=${encodeURIComponent(id)}`,
				{ method: 'POST' },
				'Break toggled.'
			);
		}
	},

	'shift.forceEnd': {
		level: managementLevel,
		run: (access, body) => {
			const id = str(body.id);
			if (!id) return Promise.resolve(bad('Unknown shift.'));

			return forward(
				access,
				`/${access.guildId}/ForceEndShift/${encodeURIComponent(id)}`,
				{ method: 'POST' },
				'Shift ended for that member.'
			);
		}
	},

	'shift.void': {
		level: managementLevel,
		run: (access, body) => {
			const id = str(body.id);
			if (!id) return Promise.resolve(bad('Unknown shift.'));

			return forward(
				access,
				`/${access.guildId}/VoidShift/${encodeURIComponent(id)}`,
				{ method: 'DELETE' },
				'Shift voided.'
			);
		}
	},

	'moderation.create': {
		run: (access, body) => {
			const username = str(body.username);
			const userId = str(body.userId);
			const type = str(body.type);
			const reason = str(body.reason);

			if (!username || !userId) return Promise.resolve(bad('Pick a player first.'));
			if (!type) return Promise.resolve(bad('Pick a punishment type.'));
			if (!reason) return Promise.resolve(bad('A reason is required.'));

			return forward(
				access,
				`/${access.guildId}/CreateModeration`,
				{
					method: 'POST',
					body: JSON.stringify({
						UserID: Number(userId),
						Username: username,
						Type: type,
						Reason: reason,
						untilEpoch: str(body.untilEpoch)
					})
				},
				`${type} logged against ${username}.`
			);
		}
	},

	'moderation.update': {
		level: punishmentLevel,
		run: (access, body) => {
			const id = str(body.id);
			const reason = str(body.reason);
			if (!id) return Promise.resolve(bad('Unknown moderation.'));
			if (!reason) return Promise.resolve(bad('A reason is required.'));

			return forward(
				access,
				`/${access.guildId}/UpdatePunishment?ID=${encodeURIComponent(id)}`,
				{
					method: 'PATCH',
					body: JSON.stringify({ Reason: reason, Type: str(body.type) })
				},
				'Moderation updated.'
			);
		}
	},

	'moderation.delete': {
		level: punishmentLevel,
		run: (access, body) => {
			const id = str(body.id);
			if (!id) return Promise.resolve(bad('Unknown moderation.'));

			return forward(
				access,
				`/${access.guildId}/DeletePunishment?ID=${encodeURIComponent(id)}`,
				{ method: 'DELETE' },
				'Moderation deleted.'
			);
		}
	},

	'moderation.complete': {
		level: punishmentLevel,
		run: (access, body) => {
			const id = str(body.id);
			const username = str(body.username);
			const reason = str(body.reason);
			const moderator = str(body.moderator);
			if (!id) return Promise.resolve(bad('Unknown moderation.'));

			const note = `BOLO marked as complete by ${access.username}. Original BOLO Reason was ${reason} made by ${moderator}.`;

			return forward(
				access,
				`/${access.guildId}/UpdatePunishment?ID=${encodeURIComponent(id)}`,
				{ method: 'PATCH', body: JSON.stringify({ Reason: note, Type: 'Ban' }) },
				`BOLO for ${username || 'that player'} marked complete.`
			);
		}
	},

	'priority.update': {
		run: (access, body) => {
			const id = str(body.id);
			const status = str(body.status);
			if (!id) return Promise.resolve(bad('Unknown priority.'));
			if (status !== 'accepted' && status !== 'denied') {
				return Promise.resolve(bad('A priority can only be accepted or denied.'));
			}

			const minutes = Number(body.minutes) || 0;
			const message = str(body.message);

			if (status === 'accepted' && minutes <= 0) {
				return Promise.resolve(bad('Set how long the priority runs for.'));
			}
			if (status === 'accepted' && !message) {
				return Promise.resolve(bad('An announcement message is required.'));
			}

			return forward(
				access,
				`/${access.guildId}/${encodeURIComponent(id)}/UpdatePriority`,
				{
					method: 'PATCH',
					body: JSON.stringify({
						status,
						reason: str(body.reason),
						priority_time: minutes,
						priority_message: message
					})
				},
				`Priority ${status}.`
			);
		}
	},

	'priority.comment': {
		run: (access, body) => {
			const id = str(body.id);
			const content = str(body.content);
			if (!id) return Promise.resolve(bad('Unknown priority.'));
			if (!content) return Promise.resolve(bad('Write a comment first.'));

			return forward(
				access,
				`/${access.guildId}/${encodeURIComponent(id)}/AddPriorityComment`,
				{ method: 'POST', body: JSON.stringify({ content }) },
				'Comment added.'
			);
		}
	},

	'request.ack': {
		run: (access, body) => {
			const id = str(body.id);
			if (!id) return Promise.resolve(bad('Unknown request.'));

			return forward(
				access,
				`/${access.guildId}/AckStaffRequest/${encodeURIComponent(id)}`,
				{ method: 'POST' },
				'Request acknowledged.'
			);
		}
	},

	'request.ackAll': {
		run: async (access, body) => {
			const ids = (Array.isArray(body.ids) ? body.ids.map(str) : []).filter(Boolean).slice(0, 50);
			if (!ids.length) return bad('There are no requests to acknowledge.');

			const replies = await Promise.all(
				ids.map((id) =>
					call(access.token, `/${access.guildId}/AckStaffRequest/${encodeURIComponent(id)}`, {
						method: 'POST'
					})
				)
			);

			const done = replies.filter((reply) => reply?.status === 200).length;
			if (!done) return bad('None of the requests could be acknowledged.', 502);

			return ok(
				done === ids.length
					? `Acknowledged ${done} request${done === 1 ? '' : 's'}.`
					: `Acknowledged ${done} of ${ids.length} requests.`
			);
		}
	},

	'announcement.send': {
		level: managementLevel,
		run: (access, body) => {
			const content = str(body.content);
			if (!content) return Promise.resolve(bad('Write an announcement first.'));

			return forward(
				access,
				`/${access.guildId}/GlobalMessage`,
				{ method: 'POST', body: JSON.stringify({ content }) },
				'Announcement sent to every staff member.'
			);
		}
	},

	'views.save': {
		run: async (access, body) => {
			const current = await getPreferences(access.token);
			if (!current) return bad('Your preferences are unavailable right now.', 502);

			const next = { ...current };
			for (const key of preferenceKeys) {
				if (typeof body[key] === 'boolean') next[key] = body[key];
			}

			if (!(await savePreferences(access.token, next))) {
				return bad('Those preferences could not be saved.', 502);
			}

			return ok('View preferences saved.');
		}
	},

	player: {
		run: (access, body) => {
			const command = playerCommands[str(body.command)];
			if (!command) return Promise.resolve(bad('Unknown player action.'));

			const target = str(command.byId ? body.playerId : body.username);
			if (!target) return Promise.resolve(bad('Unknown player.'));

			void recordRemote(access, str(body.command), str(body.username)).catch(() => null);

			return forward(
				access,
				`/${access.guildId}/${command.path}/${encodeURIComponent(target)}`,
				{ method: 'POST' },
				command.label
			);
		}
	}
};

export const POST: RequestHandler = async (event) => {
	const access = await authorizePanel(event);

	const body = (await event.request.json().catch(() => null)) as Body | null;
	if (!body) error(400, 'Malformed request.');

	const action = str(body.action);
	const command = commands[action];
	if (!command) error(404, 'Unknown action.');
	const permissionKey = panelPermissionKey(action, str(body.command));
	const granted = permissionKey ? grantsPanel(access.permissions, permissionKey) : false;

	const playerLevel = action === 'player' ? playerCommands[str(body.command)]?.level : undefined;
	const needed = command.level ?? playerLevel ?? 0;

	if (needed && access.level < needed && !granted) {
		error(
			403,
			needed >= managementLevel
				? 'Only management can do that.'
				: 'Only administrators and management can do that.'
		);
	}

	const wait = throttle(`panel:${access.token}:${access.guildId}`);
	if (wait) return bad(throttleMessage(wait), 429);

	return command.run(access, body);
};

export const GET: RequestHandler = async (event) => {
	const access = await authorizePanel(event);
	const feed = event.url.searchParams.get('feed') ?? 'snapshot';

	if (feed === 'snapshot') {
		return json(await getSnapshot(access.token, access.guildId, access.discordId));
	}

	if (feed === 'logs') {
		await refreshLogs(access.token, access.guildId);

		return json(cachedLogs(access.guildId));
	}

	if (feed === 'discord') {
		const check = await loadDiscordCheck(access.token, access.guildId);

		if (check.status === 429) {
			error(429, 'The Discord check is demanding, you can only run it every few minutes.');
		}
		if (check.status !== 200) error(502, 'The Discord check is unavailable right now.');

		return json(check.players);
	}

	if (feed === 'restricted') {
		return json(await loadVehicleRestrictions(access.token, access.guildId));
	}

	if (feed === 'moderations') {
		const params = event.url.searchParams;
		const skip = Math.max(0, Number(params.get('skip')) || 0);
		const limit = Math.min(200, Math.max(1, Number(params.get('limit')) || 100));

		return json(
			await getModerationPage(access.token, access.guildId, {
				skip,
				limit,
				type: (params.get('type') ?? '').trim(),
				username: (params.get('username') ?? '').trim(),
				userId: (params.get('userId') ?? '').trim(),
				reason: (params.get('reason') ?? '').trim(),
				from: day(params.get('from')),
				to: day(params.get('to'), 1)
			})
		);
	}

	if (feed === 'detail') {
		const userId = (event.url.searchParams.get('id') ?? '').trim();
		const moderatorId = (event.url.searchParams.get('moderatorId') ?? '').trim();
		if (!/^\d{0,20}$/.test(userId) || !/^\d{0,20}$/.test(moderatorId)) {
			error(400, 'Unknown moderation.');
		}

		return json(await getModerationDetail(access.token, userId, moderatorId));
	}

	if (feed === 'profile') {
		const id = (event.url.searchParams.get('id') ?? '').trim();
		if (!/^\d{1,20}$/.test(id)) error(400, 'Unknown player.');

		return json(await getProfile(access.token, id));
	}

	if (feed === 'roblox') {
		const query = (event.url.searchParams.get('query') ?? '').trim();
		if (query.length < 3) return json([]);

		return json(await searchRoblox(access.token, query));
	}

	error(404, 'Unknown feed.');
};
