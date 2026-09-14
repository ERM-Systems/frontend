import { error, fail, redirect } from '@sveltejs/kit';
import { blankForm, type ApplicationForm, type LiveRoster } from '$lib/applications';
import {
	commentOnResponse,
	deleteApplication,
	deleteResponse,
	getApplication,
	getErlcPlayers,
	getResponses,
	publishStaged,
	readApplication,
	reviewResponse,
	saveApplication,
	writeApplication
} from '$lib/server/applications';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import { payload } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export type { ApplicationForm, ApplicationResponse } from '$lib/applications';

function parse(body: Record<string, unknown>, id: string, guildID: string): ApplicationForm | null {
	try {
		const merged = { ...blankForm(), ...body } as ApplicationForm;
		return { ...readApplication(writeApplication(merged)), id, guildID };
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);
	const uuid = event.params.uuid;

	const application = await getApplication(token, guild.id, uuid);
	if (!application) error(502, 'That application is unavailable right now, try again shortly.');

	return {
		application,
		responses: getResponses(token, guild.id, uuid),
		erlc: application.isBanAppeal
			? getErlcPlayers(token, guild.id)
			: Promise.resolve<LiveRoster>({ players: [], offline: false, unconfigured: false })
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read this application.' });

		const settings = parse(body, event.params.uuid ?? '', guild.id);
		if (!settings) return fail(400, { message: 'Could not read this application.' });
		if (!settings.title.trim()) return fail(400, { message: 'Give this application a title.' });

		const message = await saveApplication(token, guild.id, settings);
		if (message) return fail(502, { message });

		return { settings };
	},

	review: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const responseID = String(form.get('responseID') ?? '');
		const status = String(form.get('status') ?? '');
		const reason = String(form.get('reason') ?? '').trim();
		const staged = form.get('staged') === 'on';

		if (!responseID) return fail(400, { message: 'Unknown response.' });
		if (status !== 'approved' && status !== 'denied') {
			return fail(400, { message: 'Pick approve or deny.' });
		}

		const existing = await getResponses(token, guild.id, event.params.uuid ?? '');
		const current = existing?.find((entry) => entry.responseID === responseID);
		if (current && current.reviewStatus !== 'unreviewed' && !current.staged) {
			return fail(409, { message: 'That decision was already sent and cannot be changed.' });
		}

		const message = await reviewResponse(token, guild.id, responseID, status, reason, staged);
		if (message) return fail(502, { message });

		return { reviewed: responseID };
	},

	comment: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const responseID = String(form.get('responseID') ?? '');
		const content = String(form.get('content') ?? '').trim();

		if (!responseID) return fail(400, { message: 'Unknown response.' });
		if (!content) return fail(400, { message: 'Write a comment first.' });

		const message = await commentOnResponse(token, guild.id, responseID, content.slice(0, 1000));
		if (message) return fail(502, { message });

		return { commented: responseID };
	},

	deleteResponse: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const responseID = String((await event.request.formData()).get('responseID') ?? '');
		if (!responseID) return fail(400, { message: 'Unknown response.' });

		const message = await deleteResponse(token, guild.id, responseID);
		if (message) return fail(502, { message });

		return { removed: responseID };
	},

	publish: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const message = await publishStaged(token, guild.id, event.params.uuid ?? '');
		if (message) return fail(502, { message });

		return { published: true };
	},

	deleteApplication: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const message = await deleteApplication(token, guild.id, event.params.uuid ?? '');
		if (message) return fail(502, { message });

		redirect(303, `/${guild.id}/dashboard/applications`);
	}
};
