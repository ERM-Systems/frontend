export const onboardingSteps = [
	'welcome',
	'roles',
	'shifts',
	'game',
	'logging',
	'requests',
	'sessions'
] as const;

export type OnboardingStep = (typeof onboardingSteps)[number];

export interface OnboardingState {
	roles: { staffRoles: string[]; adminRoles: string[]; managementRoles: string[] };
	shifts: { enabled: boolean; channel: string; quota: number };
	game: { linked: boolean; serverKey: string };
	logging: { punishments: string; ermLog: string };
	requests: { enabled: boolean; channel: string; loaRoles: string[] };
	sessions: { channel: string };
	completed: boolean;
	skipped: OnboardingStep[];
}

export interface StepMeta {
	id: OnboardingStep;
	label: string;
	blurb: string;
	optional: boolean;
}

export const stepMeta: StepMeta[] = [
	{
		id: 'welcome',
		label: 'Welcome to ERM',
		blurb: 'Five minutes now and your server is running. You can change all of it later.',
		optional: false
	},
	{
		id: 'roles',
		label: 'Who runs your server',
		blurb: 'ERM needs to know which Discord roles are staff before anything else works.',
		optional: false
	},
	{
		id: 'shifts',
		label: 'Shifts',
		blurb: 'Let staff clock on and off, and track how long they spend on duty.',
		optional: true
	},
	{
		id: 'game',
		label: 'Your ER:LC server',
		blurb: 'Link your private server so ERM can read players, logs and moderation.',
		optional: true
	},
	{
		id: 'logging',
		label: 'Where things get logged',
		blurb: 'Pick the channels punishments and ERM activity are posted to.',
		optional: true
	},
	{
		id: 'requests',
		label: 'Leave and reduced activity',
		blurb: 'Staff ask for time off, your management approve it in a channel.',
		optional: true
	},
	{
		id: 'sessions',
		label: 'Sessions',
		blurb: 'Post session votes and startup messages so players know when you are open.',
		optional: true
	}
];

export function blankOnboarding(): OnboardingState {
	return {
		roles: { staffRoles: [], adminRoles: [], managementRoles: [] },
		shifts: { enabled: false, channel: '', quota: 0 },
		game: { linked: false, serverKey: '' },
		logging: { punishments: '', ermLog: '' },
		requests: { enabled: false, channel: '', loaRoles: [] },
		sessions: { channel: '' },
		completed: false,
		skipped: []
	};
}

export function stepDone(state: OnboardingState, step: OnboardingStep): boolean {
	if (state.skipped.includes(step)) return true;

	switch (step) {
		case 'welcome':
			return true;
		case 'roles':
			return state.roles.managementRoles.length > 0 && state.roles.staffRoles.length > 0;
		case 'shifts':
			return state.shifts.enabled && Boolean(state.shifts.channel);
		case 'game':
			return state.game.linked;
		case 'logging':
			return Boolean(state.logging.punishments) || Boolean(state.logging.ermLog);
		case 'requests':
			return state.requests.enabled && Boolean(state.requests.channel);
		case 'sessions':
			return Boolean(state.sessions.channel);
	}
}

export function stepProblem(state: OnboardingState, step: OnboardingStep): string {
	if (step === 'roles') {
		if (!state.roles.managementRoles.length) {
			return 'Pick at least one management role, otherwise nobody can open this dashboard.';
		}
		if (!state.roles.staffRoles.length) {
			return 'Pick at least one staff role so your team can use ERM.';
		}
	}

	if (step === 'shifts' && state.shifts.enabled && !state.shifts.channel) {
		return 'Pick the channel shift activity is posted to.';
	}

	if (step === 'requests' && state.requests.enabled && !state.requests.channel) {
		return 'Pick the channel leave requests are sent to.';
	}

	return '';
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
	const index = onboardingSteps.indexOf(step);
	return index === -1 || index === onboardingSteps.length - 1 ? null : onboardingSteps[index + 1];
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
	const index = onboardingSteps.indexOf(step);
	return index <= 0 ? null : onboardingSteps[index - 1];
}

export function firstUnfinished(state: OnboardingState): OnboardingStep | null {
	return onboardingSteps.find((step) => step !== 'welcome' && !stepDone(state, step)) ?? null;
}

export function onboardingProgress(state: OnboardingState): number {
	const steps = progressSteps();
	const done = steps.filter((step) => stepDone(state, step)).length;
	return Math.round((done / steps.length) * 100);
}

export function needsOnboarding(state: OnboardingState): boolean {
	return !state.completed && !stepDone(state, 'roles');
}

export function progressSteps(): readonly OnboardingStep[] {
	return onboardingSteps.filter((step) => step !== 'welcome');
}

export function isOnboardingStep(value: unknown): value is OnboardingStep {
	return onboardingSteps.includes(value as OnboardingStep);
}
