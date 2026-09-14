import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import {
	bool,
	getServerLink,
	getSettings,
	group,
	id,
	ids,
	num,
	payload,
	previewServerKey,
	saveSettings,
	setServerKey
} from '$lib/server/settings';
import {
	isOnboardingStep,
	stepProblem,
	type OnboardingState,
	type OnboardingStep
} from '$lib/onboarding';
import type { Actions, PageServerLoad } from './$types';

function readOnboarding(raw: Record<string, unknown>, linked: boolean): OnboardingState {
	const staff = group(raw, 'staff_management');
	const shifts = group(raw, 'shift_management');
	const punishments = group(raw, 'punishments');
	const stored = group(raw, 'onboarding');

	return {
		roles: {
			staffRoles: ids(staff.role),
			adminRoles: ids(staff.admin_role),
			managementRoles: ids(staff.management_role)
		},
		shifts: {
			enabled: bool(shifts.enabled),
			channel: id(shifts.channel),
			quota: Math.max(0, num(shifts.quota))
		},
		game: { linked, serverKey: '' },
		logging: {
			punishments: id(punishments.channel),
			ermLog: id(raw.erm_log_channel)
		},
		requests: {
			enabled: bool(staff.enabled),
			channel: id(staff.channel),
			loaRoles: ids(staff.loa_role)
		},
		sessions: { channel: id(group(raw, 'sessions').channel_id) },
		completed: bool(stored.completed),
		skipped: (Array.isArray(stored.skipped) ? stored.skipped : []).filter(
			isOnboardingStep
		) as OnboardingStep[]
	};
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const [raw, link] = await Promise.all([
		getSettings(token, guild.id),
		getServerLink(token, guild.id)
	]);
	if (!raw) error(502, 'Your server settings are unavailable right now, try again shortly.');

	return { state: readOnboarding(raw, link?.linked ?? false) };
};

export const actions: Actions = {
	step: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read that step.' });

		const step = body.step;
		if (!isOnboardingStep(step)) return fail(400, { message: 'Unknown setup step.' });

		const [raw, link] = await Promise.all([
			getSettings(token, guild.id),
			getServerLink(token, guild.id)
		]);
		if (!raw) return fail(502, { message: 'Your server settings are unavailable.' });

		const state = readOnboarding(raw, link?.linked ?? false);
		const incoming = (body.state ?? {}) as Record<string, Record<string, unknown>>;

		if (step === 'roles') {
			state.roles = {
				staffRoles: ids(incoming.roles?.staffRoles),
				adminRoles: ids(incoming.roles?.adminRoles),
				managementRoles: ids(incoming.roles?.managementRoles)
			};
		}

		if (step === 'shifts') {
			state.shifts = {
				enabled: bool(incoming.shifts?.enabled),
				channel: id(incoming.shifts?.channel),
				quota: Math.max(0, num(incoming.shifts?.quota))
			};
		}

		if (step === 'requests') {
			state.requests = {
				enabled: bool(incoming.requests?.enabled),
				channel: id(incoming.requests?.channel),
				loaRoles: ids(incoming.requests?.loaRoles)
			};
		}

		if (step === 'sessions') {
			state.sessions = { channel: id(incoming.sessions?.channel) };
		}

		if (step === 'logging') {
			state.logging = {
				punishments: id(incoming.logging?.punishments),
				ermLog: id(incoming.logging?.ermLog)
			};
		}

		const problem = stepProblem(state, step);
		if (problem) return fail(400, { message: problem });

		if (step === 'welcome') return { state };

		if (step === 'game') {
			const serverKey = String(incoming.game?.serverKey ?? '').trim();

			if (serverKey) {
				const failure = await setServerKey(token, guild.id, serverKey);
				if (failure) return fail(400, { message: failure });
				state.game = { linked: true, serverKey: '' };
			}

			return { state };
		}

		const patches: Record<OnboardingStep, Record<string, unknown>> = {
			welcome: {},
			roles: {
				staff_management: {
					role: state.roles.staffRoles,
					admin_role: state.roles.adminRoles,
					management_role: state.roles.managementRoles
				}
			},
			shifts: {
				shift_management: {
					enabled: state.shifts.enabled,
					channel: state.shifts.channel,
					quota: state.shifts.quota
				}
			},
			game: {},
			logging: {
				erm_log_channel: state.logging.ermLog,
				punishments: { channel: state.logging.punishments, enabled: true }
			},
			requests: {
				staff_management: {
					enabled: state.requests.enabled,
					channel: state.requests.channel,
					loa_role: state.requests.loaRoles
				}
			},
			sessions: { sessions: { channel_id: state.sessions.channel } }
		};

		const patch = patches[step];

		const message = await saveSettings(token, guild.id, patch);
		if (message) return fail(502, { message });

		return { state };
	},

	check: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const serverKey = String((await event.request.formData()).get('serverKey') ?? '').trim();
		if (serverKey.length < 8) {
			return fail(400, { message: 'That does not look like a server key.' });
		}

		const result = await previewServerKey(token, guild.id, serverKey);
		if ('message' in result) return fail(502, { message: result.message });

		return { server: result.server };
	},

	skip: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		const step = body?.step;
		if (!isOnboardingStep(step)) return fail(400, { message: 'Unknown setup step.' });
		if (step === 'roles') return fail(400, { message: 'Roles are needed before anything works.' });

		const raw = await getSettings(token, guild.id);
		if (!raw) return fail(502, { message: 'Your server settings are unavailable.' });

		const stored = group(raw, 'onboarding');
		const skipped = new Set(
			(Array.isArray(stored.skipped) ? stored.skipped : []).filter(isOnboardingStep)
		);
		skipped.add(step);

		const message = await saveSettings(token, guild.id, {
			onboarding: { completed: bool(stored.completed), skipped: [...skipped] }
		});
		if (message) return fail(502, { message });

		return { skipped: [...skipped] };
	},

	finish: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const raw = await getSettings(token, guild.id);
		if (!raw) return fail(502, { message: 'Your server settings are unavailable.' });

		const stored = group(raw, 'onboarding');
		const message = await saveSettings(token, guild.id, {
			onboarding: {
				completed: true,
				skipped: (Array.isArray(stored.skipped) ? stored.skipped : []).filter(isOnboardingStep)
			}
		});
		if (message) return fail(502, { message });

		return { completed: true };
	}
};
