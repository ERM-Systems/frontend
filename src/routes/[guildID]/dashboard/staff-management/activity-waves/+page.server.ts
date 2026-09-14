import { fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import { previewWave, startWave, type WaveInput } from '$lib/server/staff';
import { getSettings, readInfractions } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const raw = await getSettings(token, guild.id);
	const types = raw
		? [
				...new Set(
					readInfractions(raw)
						.infractions.map((entry) => entry.name)
						.filter(Boolean)
				)
			]
		: [];

	return { types };
};

function read(form: FormData): WaveInput | null {
	const infractionType = String(form.get('infractionType') ?? '').trim();
	if (infractionType.length < 2) return null;

	const period = Number(form.get('period') ?? 0);

	return {
		infractionType: infractionType.slice(0, 32),
		period: Number.isFinite(period) ? Math.max(0, Math.round(period)) : 0,
		omitLoas: form.get('omitLoas') !== null
	};
}

export const actions: Actions = {
	preview: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const input = read(await event.request.formData());
		if (!input) return fail(400, { message: 'Choose an infraction type first.' });

		const result = await previewWave(token, guild.id, input);
		if ('message' in result) return fail(502, { message: result.message });

		return { preview: result.preview };
	},

	start: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const input = read(await event.request.formData());
		if (!input) return fail(400, { message: 'Choose an infraction type first.' });

		const message = await startWave(token, guild.id, input);
		if (message) return fail(502, { message });

		return { started: true };
	}
};
