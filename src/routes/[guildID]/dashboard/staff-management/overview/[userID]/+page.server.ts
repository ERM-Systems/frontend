import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import { getProfile } from '$lib/server/discord';
import { requireUser } from '$lib/server/session';
import { getSettings, group, readInfractions, text } from '$lib/server/settings';
import {
	addShiftTime,
	createInfraction,
	deleteInfraction,
	editInfraction,
	forceEndShift,
	forceStartShift,
	getModeratorLogs,
	getUserInfractions,
	getUserPunishments,
	getUserRoles,
	getUserShifts,
	removeShiftTime,
	revokeInfraction,
	toggleMemberBreak,
	voidShift
} from '$lib/server/staff';
import type { Actions, PageServerLoad } from './$types';

function shiftTypes(settings: Record<string, unknown> | null): string[] {
	if (!settings) return [];

	const types = group(settings, 'shift_types').types;
	if (!Array.isArray(types)) return [];

	return (types as Record<string, unknown>[]).map((type) => text(type.name)).filter(Boolean);
}

function seconds(form: FormData): number {
	const hours = Number(form.get('hours') ?? 0);
	const minutes = Number(form.get('minutes') ?? 0);
	const rest = Number(form.get('seconds') ?? 0);

	if (![hours, minutes, rest].every(Number.isFinite)) return 0;

	return Math.round(hours * 3600 + minutes * 60 + rest);
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const userId = event.params.userID;
	if (!/^\d{15,25}$/.test(userId)) error(404, 'That staff member does not exist.');

	const [profile, roles, shifts, punishments, infractions, logs, settings] = await Promise.all([
		getProfile(userId).catch(() => null),
		getUserRoles(token, guild.id, userId),
		getUserShifts(token, guild.id, userId),
		getUserPunishments(token, guild.id, userId),
		getUserInfractions(token, guild.id, userId),
		getModeratorLogs(token, guild.id, userId),
		getSettings(token, guild.id)
	]);

	const closed = shifts?.filter((shift) => shift.end) ?? [];
	const configured = settings ? readInfractions(settings).infractions : [];

	return {
		userId,
		profile,
		roles,
		shifts,
		punishments,
		infractions,
		logs,
		shiftTypes: shiftTypes(settings),
		types: configured.map((entry) => entry.name),
		escalations: Object.fromEntries(
			configured.map((entry) => [
				entry.name,
				{ threshold: entry.escalation.threshold, next: entry.escalation.next_infraction }
			])
		),
		member: {
			username: roles?.username || profile?.username || shifts?.[0]?.username || '',
			displayName: profile?.username || '',
			nickname: shifts?.find((shift) => shift.nickname)?.nickname ?? '',
			avatarUrl: profile?.avatarUrl ?? '',
			shifts: closed.length,
			total: closed.reduce((sum, shift) => sum + shift.duration, 0),
			onDuty: shifts?.some((shift) => !shift.end) ?? false
		}
	};
};

export const actions: Actions = {
	startShift: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const type = form.get('type')?.toString().trim() ?? '';
		if (!type) return fail(400, { message: 'Pick a shift type.' });

		const started = await forceStartShift(token, guild.id, event.params.userID, type);
		if ('message' in started) return fail(502, { message: started.message });

		return { started: true };
	},

	endShift: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const shiftId = form.get('shiftId')?.toString() ?? '';
		if (!shiftId) return fail(400, { message: 'Pick a shift to end.' });

		const message = await forceEndShift(token, guild.id, shiftId);
		if (message) return fail(502, { message });

		return { ended: true };
	},

	voidShift: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const shiftId = form.get('shiftId')?.toString() ?? '';
		if (!shiftId) return fail(400, { message: 'Pick a shift to void.' });

		const message = await voidShift(token, guild.id, shiftId);
		if (message) return fail(502, { message });

		return { voided: true };
	},

	toggleBreak: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const message = await toggleMemberBreak(token, guild.id, event.params.userID);
		if (message) return fail(502, { message });

		return { toggled: true };
	},

	addTime: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const shiftId = form.get('shiftId')?.toString() ?? '';
		const amount = seconds(form);

		if (!shiftId) return fail(400, { message: 'Pick a shift to change.' });
		if (amount <= 0) return fail(400, { message: 'Enter how much time to add.' });

		const message = await addShiftTime(token, guild.id, shiftId, amount);
		if (message) return fail(502, { message });

		return { timed: true };
	},

	removeTime: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const shiftId = form.get('shiftId')?.toString() ?? '';
		const amount = seconds(form);

		if (!shiftId) return fail(400, { message: 'Pick a shift to change.' });
		if (amount <= 0) return fail(400, { message: 'Enter how much time to remove.' });

		const message = await removeShiftTime(token, guild.id, shiftId, amount);
		if (message) return fail(502, { message });

		return { timed: true };
	},

	create: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const issuer = await requireUser(event.locals, event.url);

		const form = await event.request.formData();
		const username = form.get('username')?.toString() ?? '';
		const type = form.get('type')?.toString().trim() ?? '';
		const reason = form.get('reason')?.toString().trim() ?? '';

		if (!type) return fail(400, { message: 'Pick an infraction type.' });
		if (reason.length < 2 || reason.length > 1000) {
			return fail(400, { message: 'Give a reason between 2 and 1000 characters.' });
		}

		const message = await createInfraction(
			token,
			guild.id,
			issuer,
			{ userId: event.params.userID, username },
			type,
			reason
		);
		if (message) return fail(502, { message });

		return { created: true };
	},

	revoke: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const infractionId = form.get('infractionId')?.toString() ?? '';
		if (!infractionId) return fail(400, { message: 'Pick an infraction to revoke.' });

		const message = await revokeInfraction(token, guild.id, infractionId);
		if (message) return fail(502, { message });

		return { revoked: true };
	},

	edit: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const infractionId = form.get('infractionId')?.toString() ?? '';
		const type = form.get('type')?.toString().trim() ?? '';
		const reason = form.get('reason')?.toString().trim() ?? '';

		if (!infractionId) return fail(400, { message: 'Pick an infraction to edit.' });
		if (!type) return fail(400, { message: 'Pick an infraction type.' });
		if (reason.length < 2 || reason.length > 1000) {
			return fail(400, { message: 'Give a reason between 2 and 1000 characters.' });
		}

		const message = await editInfraction(token, guild.id, infractionId, type, reason);
		if (message) return fail(502, { message });

		return { edited: true };
	},

	remove: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const infractionId = form.get('infractionId')?.toString() ?? '';
		if (!infractionId) return fail(400, { message: 'Pick an infraction to delete.' });

		const message = await deleteInfraction(token, guild.id, infractionId);
		if (message) return fail(502, { message });

		return { removed: true };
	}
};
