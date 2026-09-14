import { fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import {
	getSettings,
	payload,
	readVerification,
	saveVerification,
	sendVerificationMessage
} from '$lib/server/settings';
import { readMessage } from '$lib/discord';
import { sendProblem, verificationProblem, type VerificationSettings } from '$lib/verification';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);
	const raw = await getSettings(token, guild.id);

	return { settings: readVerification(raw) };
};

function read(body: Record<string, unknown>): VerificationSettings {
	const stored = readVerification({ verification: body });

	return {
		...stored,
		message: readMessage(body.message),
		dm_message: readMessage(body.dm_message)
	};
}

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const settings = read(body);

		const problem = verificationProblem(settings);
		if (problem) return fail(400, { message: problem });

		const message = await saveVerification(token, guild.id, settings);
		if (message) return fail(502, { message });

		return { settings };
	},

	send: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const problem = sendProblem(readVerification(await getSettings(token, guild.id)));
		if (problem) return fail(400, { message: problem });

		const message = await sendVerificationMessage(token, guild.id);
		if (message) return fail(502, { message });

		return { sent: true };
	}
};
