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

export interface RoleQuota {
	role: string;
	quota: number;
}

export interface ShiftType {
	id: number;
	name: string;
	channel: string;
	nickname: string;
	role: string[];
	access_roles: string[];
	break_roles: string[];
}

export interface ShiftSettings {
	enabled: boolean;
	channel: string;
	role: string[];
	quota: number;
	maximum_staff: number;
	nickname_prefix: string;
	role_quotas: RoleQuota[];
	types: ShiftType[];
}

function list(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function read(raw: Record<string, unknown>): ShiftSettings {
	const shifts = group(raw, 'shift_management');
	const types = group(raw, 'shift_types');

	return {
		enabled: bool(shifts.enabled),
		channel: id(shifts.channel),
		role: ids(shifts.role),
		quota: Math.max(0, num(shifts.quota)),
		maximum_staff: Math.max(0, num(shifts.maximum_staff)),
		nickname_prefix: text(shifts.nickname_prefix).slice(0, 16),
		role_quotas: list(shifts.role_quotas)
			.map((quota) => ({ role: id(quota.role), quota: Math.max(0, num(quota.quota)) }))
			.filter((quota) => quota.role),
		types: list(types.types)
			.map((type) => ({
				id: num(type.id),
				name: text(type.name).slice(0, 32),
				channel: id(type.channel),
				nickname: text(type.nickname).slice(0, 16),
				role: ids(type.role),
				access_roles: ids(type.access_roles),
				break_roles: ids(type.break_roles)
			}))
			.filter((type) => type.name)
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

		const settings = read({
			shift_management: body,
			shift_types: { types: body.types }
		});

		const message = await saveSettings(
			token,
			guild.id,
			{
				shift_management: {
					enabled: settings.enabled,
					channel: settings.channel,
					role: settings.role,
					quota: settings.quota,
					maximum_staff: settings.maximum_staff,
					nickname_prefix: settings.nickname_prefix,
					role_quotas: settings.role_quotas
				},
				shift_types: { types: settings.types }
			},
			'shift-management'
		);
		if (message) return fail(502, { message });

		return { settings };
	}
};
