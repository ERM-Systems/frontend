import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import {
	acceptLoa,
	deleteLoa,
	denyLoa,
	endLoa,
	forceStartLoa,
	getGuildLoas,
	startLoa
} from '$lib/server/loa';
import { requireUser } from '$lib/server/session';
import { bool, getSettings, group, id, ids, payload, saveSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export interface LoaSettings {
	enabled: boolean;
	channel: string;
	loa_role: string[];
}

function read(raw: Record<string, unknown>): LoaSettings {
	const staff = group(raw, 'staff_management');

	return {
		enabled: bool(staff.enabled),
		channel: id(staff.channel),
		loa_role: ids(staff.loa_role)
	};
}

function field(data: FormData, name: string): string {
	return (data.get(name) ?? '').toString().trim();
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const user = await requireUser(event.locals, event.url);

	const raw = await getSettings(token, guild.id);
	if (!raw) error(502, 'Your server settings are unavailable right now, try again shortly.');

	const loas = await getGuildLoas(token, guild.id);
	if (!loas) error(502, 'Your leave requests are unavailable right now, try again shortly.');

	return { settings: read(raw), loas, viewerId: user.discordId };
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const settings = read({ staff_management: body });
		const message = await saveSettings(token, guild.id, { staff_management: settings }, 'loa');
		if (message) return fail(502, { message });

		return { settings };
	},

	accept: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const loaId = field(await event.request.formData(), 'loaId');
		if (!loaId) return fail(400, { message: 'Pick a request to accept.' });

		const message = await acceptLoa(token, guild.id, loaId);
		if (message) return fail(502, { message });

		return { accepted: true };
	},

	deny: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const data = await event.request.formData();
		const loaId = field(data, 'loaId');
		if (!loaId) return fail(400, { message: 'Pick a request to deny.' });

		const reason = field(data, 'reason');
		if (!reason) return fail(400, { message: 'Give a reason for denying this request.' });

		const message = await denyLoa(token, guild.id, loaId, reason);
		if (message) return fail(502, { message });

		return { denied: true };
	},

	create: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const data = await event.request.formData();
		const userId = field(data, 'userId');
		if (userId && !/^\d{17,20}$/.test(userId)) {
			return fail(400, { message: 'That is not a Discord user ID.' });
		}

		const reason = field(data, 'reason');
		if (!reason) return fail(400, { message: 'Give a reason for this leave.' });

		const expiry = Number(field(data, 'expiry'));
		if (!Number.isFinite(expiry) || expiry <= Math.floor(Date.now() / 1000)) {
			return fail(400, { message: 'Pick a date and time in the future.' });
		}

		const message = userId
			? await forceStartLoa(token, guild.id, userId, expiry, reason)
			: await startLoa(token, guild.id, expiry, reason);
		if (message) return fail(502, { message });

		return { created: true };
	},

	end: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const data = await event.request.formData();
		const loaId = field(data, 'loaId');
		if (!loaId) return fail(400, { message: 'Pick a leave to end.' });

		const message = await endLoa(token, guild.id, loaId, data.get('forced') === 'true');
		if (message) return fail(502, { message });

		return { ended: true };
	},

	remove: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const loaId = field(await event.request.formData(), 'loaId');
		if (!loaId) return fail(400, { message: 'Pick a leave to delete.' });

		const message = await deleteLoa(token, guild.id, loaId);
		if (message) return fail(502, { message });

		return { removed: true };
	}
};
