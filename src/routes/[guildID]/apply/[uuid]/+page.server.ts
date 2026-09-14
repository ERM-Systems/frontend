import { error, fail } from '@sveltejs/kit';
import {
	checkAnswers,
	imagePoint,
	publicForm,
	type ApplicationForm,
	type ApplicationResponse,
	type ResponseScore,
	type RobloxData
} from '$lib/applications';
import { isAffiliate } from '$lib/server/affiliates';
import {
	getApplication,
	getBans,
	getRobloxData,
	getUserResponses,
	getUserRoles,
	submitResponse
} from '$lib/server/applications';
import { getMyModerations } from '$lib/server/overview';
import { throttle, throttleMessage } from '$lib/server/ratelimit';
import { requireUser, sessionCookie } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export interface Gate {
	title: string;
	message: string;
	markdown: boolean;
}

export interface Review {
	status: 'approved' | 'denied';
	reason: string;
	submittedAt: string;
	answers: Record<string, unknown>;
	score: ResponseScore | null;
}

const day = 24 * 60 * 60 * 1000;
const discordEpoch = 1_420_070_400_000;

function accountAge(discordId: string): number {
	try {
		return (Date.now() - (Number(BigInt(discordId) >> 22n) + discordEpoch)) / day;
	} catch {
		return Infinity;
	}
}

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function findReview(form: ApplicationForm, responses: ApplicationResponse[]): Review | null {
	if (!form.scoring.allowReview || !responses.length) return null;

	const latest = responses.reduce((newest, entry) =>
		(Date.parse(entry.submittedAt) || 0) > (Date.parse(newest.submittedAt) || 0) ? entry : newest
	);

	if (latest.staged || latest.reviewStatus === 'unreviewed') return null;

	const shareScore = form.scoring.enabled && form.scoring.showApplicants;

	return {
		status: latest.reviewStatus,
		reason: latest.reason,
		submittedAt: latest.submittedAt,
		answers: latest.answers,
		score: shareScore && latest.score ? latest.score : null
	};
}

async function findGate(
	form: ApplicationForm,
	token: string,
	guildId: string,
	discordId: string
): Promise<{ gate: Gate | null; roblox: RobloxData | null; responses?: ApplicationResponse[] }> {
	if (!form.acceptingResponses) {
		return {
			gate: {
				title: 'Applications are closed',
				message: form.closedMessage || 'This form is not accepting responses right now.',
				markdown: true
			},
			roblox: null
		};
	}

	if (form.requiredRoles.length || form.blacklistedRoles.length) {
		const roles = await getUserRoles(token, guildId, discordId);

		if (!roles) {
			return {
				gate: {
					title: 'You are not in this server',
					message: 'Join the Discord server this form belongs to, then come back and try again.',
					markdown: false
				},
				roblox: null
			};
		}

		if (form.requiredRoles.length && !form.requiredRoles.some((role) => roles.includes(role))) {
			return {
				gate: {
					title: 'You are missing a required role',
					message: 'You do not have any of the roles this form asks for.',
					markdown: false
				},
				roblox: null
			};
		}

		if (form.blacklistedRoles.some((role) => roles.includes(role))) {
			return {
				gate: {
					title: 'You cannot apply',
					message: 'One of your roles blocks you from sending this application.',
					markdown: false
				},
				roblox: null
			};
		}
	}

	if (form.minimumAccountAge && accountAge(discordId) < form.minimumAccountAge) {
		return {
			gate: {
				title: 'Your account is too new',
				message: `Your Discord account has to be at least ${plural(form.minimumAccountAge, 'day')} old to apply.`,
				markdown: false
			},
			roblox: null
		};
	}

	let roblox: RobloxData | null = null;
	if (form.robloxRequired) {
		roblox = await getRobloxData(token);

		if (!roblox) {
			return {
				gate: {
					title: 'Link your ROBLOX account',
					message:
						'This form needs a linked ROBLOX account. Link one in your settings, then retry.',
					markdown: false
				},
				roblox: null
			};
		}

		if (form.isBanAppeal) {
			const bans = await getBans(token, guildId);
			const banned = bans?.some((ban) => ban.id === String(roblox?.robloxID));

			if (!banned) {
				return {
					gate: {
						title: 'You are not banned',
						message: 'This is a ban appeal and there is no active ban on your ROBLOX account.',
						markdown: false
					},
					roblox
				};
			}
		}

		if (form.maxLogs) {
			const record = await getMyModerations(token, guildId);

			if (record && record.moderations.length > form.maxLogs) {
				return {
					gate: {
						title: 'Too many moderation logs',
						message: `This form only accepts applicants with ${plural(form.maxLogs, 'log')} or fewer.`,
						markdown: false
					},
					roblox
				};
			}
		}
	}

	const responses = await getUserResponses(token, guildId, form.id);

	if (responses.some((entry) => entry.staged || entry.reviewStatus === 'unreviewed')) {
		return {
			gate: {
				title: 'You already applied',
				message: 'Your last application is still waiting on a decision, hang tight.',
				markdown: false
			},
			roblox,
			responses
		};
	}

	if (form.maxResponses && responses.length >= form.maxResponses) {
		return {
			gate: {
				title: 'Response limit reached',
				message: `You've submitted the maximum number of responses for this form. Contact a staff member to delete a previous response.`,
				markdown: false
			},
			roblox,
			responses
		};
	}

	if (form.cooldown && responses.length) {
		const last = Math.max(...responses.map((entry) => Date.parse(entry.submittedAt) || 0));
		const until = last + form.cooldown * day;

		if (last && Date.now() < until) {
			const left = Math.ceil((until - Date.now()) / day);

			return {
				gate: {
					title: 'You are on cooldown',
					message: `You can apply again in ${plural(left, 'day')}.`,
					markdown: false
				},
				roblox,
				responses
			};
		}
	}

	return { gate: null, roblox, responses };
}

export const load: PageServerLoad = async ({ cookies, locals, params, url }) => {
	const guildId = params.guildID;
	if (!/^\d{17,20}$/.test(guildId)) error(404, 'That server does not exist.');
	if (!(await isAffiliate(guildId))) error(404, 'That server does not exist.');

	const user = await requireUser(locals, url);
	const token = cookies.get(sessionCookie) ?? '';

	const form = await getApplication(token, guildId, params.uuid);
	if (!form) error(404, 'That application does not exist.');

	const { gate, responses } = await findGate(form, token, guildId, user.discordId);
	const seen =
		responses ?? (form.scoring.allowReview ? await getUserResponses(token, guildId, form.id) : []);

	return { form: publicForm(form), gate, review: findReview(form, seen) };
};

export const actions: Actions = {
	default: async ({ cookies, locals, params, request }) => {
		const token = cookies.get(sessionCookie);
		const user = await locals.session;
		if (!token || !user) return fail(401, { message: 'Your session expired, sign in again.' });

		const guildId = params.guildID;
		const wait = throttle(`apply:${token}:${params.uuid}`);
		if (wait) return fail(429, { message: throttleMessage(wait) });

		const form = await getApplication(token, guildId, params.uuid);
		if (!form) return fail(404, { message: 'That application does not exist.' });

		const { gate } = await findGate(form, token, guildId, user.discordId);
		if (gate) return fail(403, { message: gate.message });

		let answers: Record<string, unknown>;
		try {
			answers = JSON.parse(String((await request.formData()).get('answers') ?? '{}'));
		} catch {
			return fail(400, { message: 'Your answers could not be read, refresh and try again.' });
		}

		if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
			return fail(400, { message: 'Your answers could not be read, refresh and try again.' });
		}

		const errors = checkAnswers(form, answers);
		if (Object.keys(errors).length) {
			return fail(400, { message: 'Some answers still need fixing.', errors });
		}

		for (const question of form.questions) {
			if (question.type !== 'image_selection') continue;

			const point = imagePoint(answers[question.id]);
			if (!point) continue;

			answers[question.id] = { coordinates: point };
		}

		const message = await submitResponse(token, guildId, form.id, { answers });
		if (message) return fail(502, { message });

		return { submitted: true };
	}
};
