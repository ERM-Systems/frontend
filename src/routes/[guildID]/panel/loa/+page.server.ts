import { error, fail } from '@sveltejs/kit';
import { endMyLoa, getMyLoas, startLoa } from '$lib/server/loa';
import { authorizePanel } from '$lib/server/panel';
import type { Actions, PageServerLoad } from './$types';

function field(data: FormData, name: string): string {
	return (data.get(name) ?? '').toString().trim();
}

export const load: PageServerLoad = async (event) => {
	const access = await authorizePanel(event);

	const loas = await getMyLoas(access.token, access.guildId);
	if (!loas) error(502, 'Your leave requests are unavailable right now, try again shortly.');

	return { guild: access.guild, loas };
};

export const actions: Actions = {
	create: async (event) => {
		const access = await authorizePanel(event);
		const data = await event.request.formData();

		const reason = field(data, 'reason');
		if (!reason) return fail(400, { message: 'Give a reason for this leave.' });

		const expiry = Number(field(data, 'expiry'));
		if (!Number.isFinite(expiry) || expiry <= Math.floor(Date.now() / 1000)) {
			return fail(400, { message: 'Pick a date and time in the future.' });
		}

		const message = await startLoa(access.token, access.guildId, expiry, reason);
		if (message) return fail(502, { message });

		return { created: true };
	},

	end: async (event) => {
		const access = await authorizePanel(event);

		const loaId = field(await event.request.formData(), 'loaId');
		if (!loaId) return fail(400, { message: 'Pick a leave to end.' });

		const message = await endMyLoa(access.token, access.guildId, loaId);
		if (message) return fail(502, { message });

		return { ended: true };
	}
};
