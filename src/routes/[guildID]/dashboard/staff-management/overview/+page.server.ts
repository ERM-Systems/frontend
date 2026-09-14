import { fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import { getProfile } from '$lib/server/discord';
import { getSettings, group, num, text } from '$lib/server/settings';
import {
	deleteSnapshotCode,
	forceEndShift,
	forceStartShift,
	getShifts,
	getSnapshotCodes,
	getSnapshotShifts,
	restoreSnapshot,
	saveShiftSnapshot
} from '$lib/server/staff';
import type { Actions, PageServerLoad } from './$types';

export interface StaffSummary {
	userId: string;
	username: string;
	nickname: string;
	avatarUrl: string;
	shifts: number;
	total: number;
	lastShift: number;
	onDuty: boolean;
	moderations: number;
}

const periods = ['7', '14', '30', 'all'];
const batch = 20;
const upfront = 30;
const management = 3;

async function attachAvatars(staff: StaffSummary[]) {
	for (let index = 0; index < staff.length; index += batch) {
		const slice = staff.slice(index, index + batch);
		const profiles = await Promise.all(
			slice.map((member) => getProfile(member.userId).catch(() => null))
		);

		slice.forEach((member, position) => (member.avatarUrl = profiles[position]?.avatarUrl ?? ''));
	}
}

async function remainingAvatars(staff: StaffSummary[]): Promise<Record<string, string>> {
	await attachAvatars(staff);
	return Object.fromEntries(
		staff.filter((member) => member.avatarUrl).map((member) => [member.userId, member.avatarUrl])
	);
}

function shiftTypes(settings: Record<string, unknown> | null): string[] {
	if (!settings) return [];

	const types = group(settings, 'shift_types').types;
	if (!Array.isArray(types)) return [];

	return (types as Record<string, unknown>[]).map((type) => text(type.name)).filter(Boolean);
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const requested = event.url.searchParams.get('period') ?? '';
	const period = periods.includes(requested) ? requested : '14';
	const cutoff = period === 'all' ? 0 : Date.now() / 1000 - Number(period) * 86_400;

	const code = (event.url.searchParams.get('code') ?? '').trim().slice(0, 32);
	const privileged = guild.permissionLevel >= management;

	const [shifts, settings, codes] = await Promise.all([
		code ? getSnapshotShifts(token, guild.id, code) : getShifts(token, guild.id),
		getSettings(token, guild.id),
		privileged ? getSnapshotCodes(token, guild.id) : Promise.resolve(null)
	]);

	const shared = {
		period,
		code,
		codes,
		types: shiftTypes(settings),
		quota: settings ? Math.max(0, num(group(settings, 'shift_management').quota)) : 0
	};

	if (!shifts) {
		return { ...shared, staff: null, avatars: Promise.resolve({} as Record<string, string>) };
	}

	const members = new Map<string, StaffSummary>();

	for (const shift of shifts) {
		if (shift.start < cutoff) continue;

		const member = members.get(shift.userId) ?? {
			userId: shift.userId,
			username: shift.username,
			nickname: shift.nickname,
			avatarUrl: '',
			shifts: 0,
			total: 0,
			lastShift: 0,
			onDuty: false,
			moderations: 0
		};

		if (shift.end) {
			member.shifts += 1;
			member.total += shift.duration;
		} else {
			member.onDuty = true;
		}

		member.lastShift = Math.max(member.lastShift, shift.start);
		member.moderations += shift.moderations;
		member.username ||= shift.username;
		member.nickname ||= shift.nickname;

		members.set(shift.userId, member);
	}

	const staff = [...members.values()].sort((a, b) => b.total - a.total);
	await attachAvatars(staff.slice(0, upfront));

	return { ...shared, staff, avatars: remainingAvatars(staff.slice(upfront)) };
};

export const actions: Actions = {
	createShift: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const userId = form.get('userId')?.toString() ?? '';
		const type = form.get('type')?.toString().trim() ?? '';
		const persist = form.get('persist') === 'on';

		if (!/^\d{15,25}$/.test(userId)) return fail(400, { message: 'Pick a member to put on duty.' });
		if (!type) return fail(400, { message: 'Pick a shift type.' });

		const started = await forceStartShift(token, guild.id, userId, type);
		if ('message' in started) return fail(502, { message: started.message });

		if (persist) return { started: true };

		if (!started.shiftId) {
			return fail(502, { message: 'ERM started that shift but did not send back its id.' });
		}

		const message = await forceEndShift(token, guild.id, started.shiftId);
		if (message) return fail(502, { message });

		return { started: true };
	},

	saveSnapshot: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const saved = await saveShiftSnapshot(token, guild.id);
		if ('message' in saved) return fail(502, { message: saved.message });

		return { code: saved.code };
	},

	deleteSnapshot: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const code = form.get('code')?.toString().trim() ?? '';
		if (!code) return fail(400, { message: 'Pick a snapshot to delete.' });

		const message = await deleteSnapshotCode(token, guild.id, code);
		if (message) return fail(502, { message });

		return { deleted: true };
	},

	restoreSnapshot: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const code = form.get('code')?.toString().trim() ?? '';
		if (!code) return fail(400, { message: 'Pick a snapshot to restore.' });

		const message = await restoreSnapshot(token, guild.id, code);
		if (message) return fail(502, { message });

		return { restored: true };
	}
};
