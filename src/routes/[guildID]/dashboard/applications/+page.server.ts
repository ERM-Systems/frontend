import { error, fail, redirect } from '@sveltejs/kit';
import { descriptionLimit, titleLimit, type ApplicationForm } from '$lib/applications';
import {
	createApplication,
	deleteApplication,
	getApplication,
	getApplications,
	getResponses,
	saveApplication
} from '$lib/server/applications';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import type { Actions, PageServerLoad } from './$types';

export interface ResponseCounts {
	total: number;
	pending: number;
	latest: number;
}

async function countFor(
	token: string,
	guildId: string,
	applicationId: string
): Promise<ResponseCounts> {
	const responses = await getResponses(token, guildId, applicationId);
	if (!responses) return { total: 0, pending: 0, latest: 0 };

	const latest = responses.reduce((newest, entry) => {
		const stamp = Date.parse(entry.submittedAt);
		return Number.isFinite(stamp) ? Math.max(newest, Math.round(stamp / 1000)) : newest;
	}, 0);

	return {
		total: responses.length,
		pending: responses.filter((entry) => entry.reviewStatus === 'unreviewed').length,
		latest
	};
}

async function countAll(
	token: string,
	guildId: string,
	applications: ApplicationForm[]
): Promise<Record<string, ResponseCounts>> {
	const entries = await Promise.all(
		applications.map(async (form) => [form.id, await countFor(token, guildId, form.id)] as const)
	);

	return Object.fromEntries(entries);
}

function checkDetails(title: string, description: string): string | null {
	if (!title) return 'Give this application a title.';
	if (title.length > titleLimit) return `Keep the title under ${titleLimit} characters.`;
	if (description.length > descriptionLimit) {
		return `Keep the description under ${descriptionLimit} characters.`;
	}

	return null;
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const access = await getApplications(token, guild.id);
	if (!access) error(502, 'Your applications are unavailable right now, try again shortly.');

	return {
		applications: access.applications,
		isApplicationReviewer: access.isApplicationReviewer,
		counts: countAll(token, guild.id, access.applications)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const title = String(form.get('title') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();

		const problem = checkDetails(title, description);
		if (problem) return fail(400, { message: problem });

		const id = await createApplication(token, guild.id, title, description);
		if (!id) return fail(502, { message: 'Could not create that application, try again shortly.' });

		redirect(303, `/${guild.id}/dashboard/applications/${id}`);
	},

	duplicate: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const sourceId = String((await event.request.formData()).get('id') ?? '');
		if (!sourceId) return fail(400, { message: 'Unknown application.' });

		const source = await getApplication(token, guild.id, sourceId);
		if (!source) return fail(502, { message: 'Could not read that application.' });

		const title = `Copy of ${source.title}`.slice(0, titleLimit);
		const problem = checkDetails(title, source.description);
		if (problem) return fail(400, { message: problem });

		const id = await createApplication(token, guild.id, title, source.description);
		if (!id) return fail(502, { message: 'Could not copy that application, try again shortly.' });

		const message = await saveApplication(token, guild.id, {
			...source,
			id,
			guildID: guild.id,
			title
		});
		if (message) return fail(502, { message });

		redirect(303, `/${guild.id}/dashboard/applications/${id}`);
	},

	remove: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const id = String((await event.request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Unknown application.' });

		const message = await deleteApplication(token, guild.id, id);
		if (message) return fail(502, { message });

		return { removed: id };
	}
};
