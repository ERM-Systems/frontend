import { fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import { requireUser } from '$lib/server/session';
import { getSettings, readInfractions } from '$lib/server/settings';
import {
	createInfraction,
	deleteInfraction,
	editInfraction,
	getInfractions,
	revokeInfraction
} from '$lib/server/staff';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const [infractions, settings] = await Promise.all([
		getInfractions(token, guild.id),
		getSettings(token, guild.id)
	]);

	const configured = settings ? readInfractions(settings).infractions : [];

	return {
		infractions,
		types: configured.map((entry) => entry.name),
		escalations: Object.fromEntries(
			configured.map((entry) => [
				entry.name,
				{ threshold: entry.escalation.threshold, next: entry.escalation.next_infraction }
			])
		)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const issuer = await requireUser(event.locals, event.url);

		const form = await event.request.formData();
		const userId = form.get('userId')?.toString() ?? '';
		const username = form.get('username')?.toString() ?? '';
		const type = form.get('type')?.toString().trim() ?? '';
		const reason = form.get('reason')?.toString().trim() ?? '';

		if (!/^\d{15,25}$/.test(userId)) return fail(400, { message: 'Pick a member to infract.' });
		if (!type) return fail(400, { message: 'Pick an infraction type.' });
		if (reason.length < 2 || reason.length > 1000) {
			return fail(400, { message: 'Give a reason between 2 and 1000 characters.' });
		}

		const message = await createInfraction(
			token,
			guild.id,
			issuer,
			{ userId, username },
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
