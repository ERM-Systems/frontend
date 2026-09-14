import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeStrict } from '$lib/server/dashboard';
import { getAnalytics } from '$lib/server/analytics';
import {
	bool,
	getSettings,
	group,
	num,
	payload,
	readSessions,
	saveSessions,
	saveSettings,
	text
} from '$lib/server/settings';
import {
	createSessionVote,
	deleteSession,
	endSession,
	getActiveSession,
	getSessionHistory,
	startSession
} from '$lib/server/sessions';
import { ComponentType, isEmptyMessage, validateMessage } from '$lib/discord';
import { sessionLimits, sessionMessages, voteButtonId, voteMessages } from '$lib/sessions';
import {
	aopActions,
	blankAopSettings,
	clampPoint,
	maxPoints,
	maxRegions,
	maxWarningMessage,
	minPoints,
	type AopPoint,
	type AopSettings
} from '$lib/aop';
import type { Actions, PageServerLoad } from './$types';

export type { SessionSettings, ActiveSession, SessionHistoryEntry } from '$lib/sessions';

function readAop(raw: Record<string, unknown>): AopSettings {
	const aop = group(raw, 'area_of_play');
	const blank = blankAopSettings();

	const regions = (Array.isArray(aop.regions) ? aop.regions : [])
		.slice(0, maxRegions)
		.map((entry, index) => {
			const region = entry as Record<string, unknown>;
			const points = (Array.isArray(region.points) ? region.points : [])
				.slice(0, maxPoints)
				.map((point) =>
					clampPoint({ x: num((point as AopPoint).x), z: num((point as AopPoint).z) })
				);

			return {
				id: text(region.id) || `region-${index + 1}`,
				name: text(region.name, `Area ${index + 1}`).slice(0, 40),
				points
			};
		})
		.filter((region) => region.name);

	const action = aopActions.find((entry) => entry === text(aop.action)) ?? blank.action;
	const chosen = text(aop.default_region);

	return {
		enabled: bool(aop.enabled),
		sessions_only: aop.sessions_only === undefined ? true : bool(aop.sessions_only),
		regions,
		default_region: regions.some((region) => region.id === chosen) ? chosen : '',
		grace_seconds: Math.min(3600, Math.max(0, num(aop.grace_seconds, blank.grace_seconds))),
		warnings: Math.min(10, Math.max(0, num(aop.warnings, blank.warnings))),
		action,
		warning_message: text(aop.warning_message, blank.warning_message).slice(0, maxWarningMessage)
	};
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeStrict(event);

	const raw = await getSettings(token, guild.id);
	if (!raw) error(502, 'Your session settings are unavailable right now, try again shortly.');

	const [active, history] = await Promise.all([
		getActiveSession(token, guild.id),
		getSessionHistory(token, guild.id)
	]);

	const now = Math.floor(Date.now() / 1000);

	return {
		settings: readSessions(raw),
		aop: readAop(raw),
		active,
		history,
		analytics: getAnalytics(token, guild.id, now - 30 * 86400, now).catch(() => []),
		management: guild.permissionLevel >= 3
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;
		if (guild.permissionLevel < 3) {
			return fail(403, { message: 'Only management can change these settings.' });
		}

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const settings = readSessions({ sessions: body });

		for (const entry of sessionMessages) {
			const message = settings[entry.id];
			if (isEmptyMessage(message)) continue;

			const issue = validateMessage(message)[0];
			if (issue) return fail(400, { message: `${entry.label} message: ${issue.message}` });

			if (voteMessages.includes(entry.id)) {
				const counts = message.components.some(
					(component) =>
						component.type === ComponentType.ActionRow &&
						component.components.some((button) => button.custom_id === voteButtonId)
				);

				if (!counts) {
					return fail(400, {
						message: `The ${entry.label.toLowerCase()} message needs a button set to count a vote.`
					});
				}

				continue;
			}

			const clickable = message.components.some(
				(component) =>
					component.type === ComponentType.ActionRow &&
					component.components.some((button) => button.style !== 5)
			);

			if (clickable) {
				return fail(400, {
					message: `The ${entry.label.toLowerCase()} message can only use link buttons.`
				});
			}
		}

		const message = await saveSessions(token, guild.id, settings);
		if (message) return fail(502, { message });

		return { settings };
	},

	aop: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;
		if (guild.permissionLevel < 3) {
			return fail(403, { message: 'Only management can change these settings.' });
		}

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read that area of play.' });

		const aop = readAop({ area_of_play: body });

		const short = aop.regions.find((region) => region.points.length < minPoints);
		if (short) {
			return fail(400, { message: `${short.name} needs at least ${minPoints} points.` });
		}

		const message = await saveSettings(token, guild.id, { area_of_play: aop }, 'sessions');
		if (message) return fail(502, { message });

		return { settings: aop };
	},

	vote: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const required = Math.round(num((await event.request.formData()).get('required_votes')));
		const message = await createSessionVote(
			token,
			guild.id,
			Math.min(sessionLimits.requiredVotes, Math.max(0, required))
		);
		if (message) return fail(502, { message });

		return { active: await getActiveSession(token, guild.id) };
	},

	start: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const message = await startSession(token, guild.id);
		if (message) return fail(502, { message });

		return { active: await getActiveSession(token, guild.id) };
	},

	end: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const message = await endSession(token, guild.id);
		if (message) return fail(502, { message });

		return { active: null, history: await getSessionHistory(token, guild.id) };
	},

	deleteSession: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;
		if (guild.permissionLevel < 3) {
			return fail(403, { message: 'Only management can delete session data.' });
		}

		const sessionId = (await event.request.formData()).get('sessionId')?.toString() ?? '';
		if (!/^[0-9a-f]{24}$/i.test(sessionId)) {
			return fail(400, { message: 'Pick a session to delete.' });
		}

		const message = await deleteSession(token, guild.id, sessionId);
		if (message) return fail(502, { message });

		return { history: await getSessionHistory(token, guild.id) };
	}
};
