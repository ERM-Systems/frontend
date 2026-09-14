import { env } from '$env/dynamic/private';
import {
	answerable,
	blankForm,
	hasOptions,
	optionLimit,
	optionsPerQuestion,
	questionLimit,
	responseLimit,
	presetLimit,
	titleLimit,
	descriptionLimit,
	questionTitleLimit,
	questionDescriptionLimit,
	messageLimit,
	questionKinds,
	validationKinds,
	type ApplicationDecisionEmbeds,
	type ApplicationForm,
	type ApplicationResponse,
	type Comment,
	type LiveRoster,
	type Preset,
	type Question,
	type QuestionType,
	type ResponseScore,
	type RobloxData,
	type SelectionArea,
	type ValidationRule,
	type ValidationType
} from '$lib/applications';
import { packMessage, readMessage, type DiscordMessage } from '$lib/discord';
import { bool, id, ids, num, text } from './settings';
import { revokeSession } from './session';

interface Reply {
	ok: boolean;
	status: number;
	body: Record<string, unknown>;
}

const timeout = 15_000;

async function call(
	token: string,
	path: string,
	method = 'GET',
	body?: unknown
): Promise<Reply | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}${path}`, {
			method,
			headers: {
				Authorization: token,
				...(body === undefined ? {} : { 'content-type': 'application/json' })
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(timeout)
		});

		const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
		if (!response.ok) {
			console.warn(
				`${path} responded ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`
			);
			if (response.status === 401) revokeSession(token);
		}

		return { ok: response.ok, status: response.status, body: payload };
	} catch (error) {
		console.warn(`${path} failed:`, error);
		return null;
	}
}

function reason(reply: Reply | null, fallback: string): string {
	const message = reply?.body.message;
	return typeof message === 'string' && message ? message : fallback;
}

function list(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value)
		? (value.filter((entry) => !!entry) as Record<string, unknown>[])
		: [];
}

function strings(value: unknown, limit: number, cap: number): string[] {
	return (Array.isArray(value) ? value : [])
		.map((entry) => String(entry).slice(0, limit))
		.filter((entry) => entry.trim())
		.slice(0, cap);
}

function hex(value: unknown, fallback: string): string {
	const raw = text(value).trim();
	return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : fallback;
}

function clamp(value: unknown, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.round(num(value))));
}

function questionType(value: unknown): QuestionType {
	const raw = text(value) as QuestionType;
	return questionKinds.some((kind) => kind.value === raw) ? raw : 'short';
}

function readArea(value: unknown): SelectionArea | undefined {
	if (!value || typeof value !== 'object') return undefined;

	const raw = value as Record<string, unknown>;
	const area = { x: num(raw.x), y: num(raw.y), width: num(raw.width), height: num(raw.height) };

	return area.width > 0 && area.height > 0 ? area : undefined;
}

function readRules(value: unknown, type: QuestionType): ValidationRule[] {
	return list(value)
		.map((raw) => {
			const kind = text(raw.type) as ValidationType;
			const params = (raw.params ?? {}) as Record<string, unknown>;

			return {
				id: text(raw.id) || crypto.randomUUID(),
				type: kind,
				params: {
					minLength: params.minLength === undefined ? undefined : clamp(params.minLength, 0, 5000),
					maxLength: params.maxLength === undefined ? undefined : clamp(params.maxLength, 0, 5000),
					minWords: params.minWords === undefined ? undefined : clamp(params.minWords, 0, 5000),
					maxWords: params.maxWords === undefined ? undefined : clamp(params.maxWords, 0, 5000),
					minSentences:
						params.minSentences === undefined ? undefined : clamp(params.minSentences, 0, 500),
					minValue: params.minValue === undefined ? undefined : num(params.minValue),
					maxValue: params.maxValue === undefined ? undefined : num(params.maxValue),
					pattern: params.pattern === undefined ? undefined : text(params.pattern).slice(0, 200),
					text: params.text === undefined ? undefined : text(params.text).slice(0, 200),
					allowedValues:
						params.allowedValues === undefined
							? undefined
							: strings(params.allowedValues, 200, 100),
					minDate: params.minDate === undefined ? undefined : text(params.minDate).slice(0, 40),
					maxDate: params.maxDate === undefined ? undefined : text(params.maxDate).slice(0, 40),
					minChoices:
						params.minChoices === undefined
							? undefined
							: clamp(params.minChoices, 0, optionsPerQuestion),
					maxChoices:
						params.maxChoices === undefined
							? undefined
							: clamp(params.maxChoices, 0, optionsPerQuestion),
					caseSensitive: params.caseSensitive === undefined ? undefined : bool(params.caseSensitive)
				},
				errorMessage: text(raw.errorMessage).slice(0, 200)
			};
		})
		.filter((rule) =>
			validationKinds.some((kind) => kind.value === rule.type && kind.types.includes(type))
		)
		.slice(0, 10);
}

function readPresets(value: unknown): Preset[] {
	return list(value)
		.map((raw) => ({
			name: text(raw.name).trim().slice(0, 100),
			value: text(raw.value).trim().slice(0, messageLimit)
		}))
		.filter((preset) => preset.name && preset.value)
		.slice(0, presetLimit);
}

function readDecisionEmbeds(value: unknown): ApplicationDecisionEmbeds {
	const raw = (value ?? {}) as Record<string, unknown>;
	return {
		acceptDM: readMessage(raw.acceptDM),
		acceptPublic: readMessage(raw.acceptPublic),
		denyDM: readMessage(raw.denyDM),
		denyPublic: readMessage(raw.denyPublic)
	};
}

function packDecisionMessage(message: DiscordMessage): Record<string, unknown> {
	const packed = packMessage(message);
	const embeds = Array.isArray(packed.embeds) ? (packed.embeds as Record<string, unknown>[]) : [];
	return { ...packed, ...(embeds.length ? { embed: embeds[0] } : {}) };
}

function readQuestions(value: unknown, scoring: Record<string, unknown>): Question[] {
	return list(value)
		.map((raw) => {
			const type = questionType(raw.type);
			const options = hasOptions(type) ? strings(raw.options, optionLimit, optionsPerQuestion) : [];
			const entry = (scoring[text(raw.id)] ?? {}) as Record<string, unknown>;
			const correct = strings(entry.correct, optionLimit, optionsPerQuestion);

			return {
				id: text(raw.id) || crypto.randomUUID(),
				type,
				title: text(raw.title).slice(0, questionTitleLimit),
				description: text(raw.description).slice(0, questionDescriptionLimit),
				required: bool(raw.required),
				options,
				correct: correct.filter((entry) => options.includes(entry)),
				points: clamp(entry.points ?? 0, 0, 1000),
				validationRules: readRules(raw.validationRules, type),
				imageUrl: text(raw.imageUrl) || undefined,
				selectionArea: type === 'image_selection' ? readArea(raw.selectionArea) : undefined
			};
		})
		.slice(0, questionLimit);
}

export function readApplication(raw: Record<string, unknown>): ApplicationForm {
	const blank = blankForm();
	const scoring = (raw.scoring ?? {}) as Record<string, unknown>;
	const perQuestion = (scoring.questions ?? {}) as Record<string, unknown>;

	return {
		id: text(raw.id),
		guildID: text(raw.guildID),
		title: text(raw.title).slice(0, titleLimit),
		description: text(raw.description).slice(0, descriptionLimit),
		bannerUrl: text(raw.bannerUrl).startsWith('https://') ? text(raw.bannerUrl) : '',
		themeColor: hex(raw.themeColor, blank.themeColor),
		questions: readQuestions(raw.questions, perQuestion),
		acceptingResponses: bool(raw.acceptingResponses),
		closedMessage: text(raw.closedMessage).slice(0, messageLimit),
		submittedMessage: text(raw.submittedMessage).slice(0, messageLimit),
		robloxRequired: bool(raw.robloxRequired),
		isBanAppeal: bool(raw.isBanAppeal),
		minimumAccountAge: clamp(raw.minimumAccountAge, 0, 3650),
		maxLogs: clamp(raw.maxLogs, 0, 1000),
		maxResponses: clamp(raw.maxResponses, 0, responseLimit),
		cooldown: clamp(raw.cooldown, 0, 365),
		stageResponses: bool(raw.stageResponses),
		resultsChannel: id(raw.resultsChannel),
		alertChannel: id(raw.alertChannel),
		alertRoles: ids(raw.alertRoles),
		requiredRoles: ids(raw.requiredRoles),
		blacklistedRoles: ids(raw.blacklistedRoles),
		editorRoles: ids(raw.editorRoles),
		rolesAddedOnApproval: ids(raw.rolesAddedOnApproval),
		rolesRemovedOnApproval: ids(raw.rolesRemovedOnApproval),
		rolesRemovedOnDenial: ids(raw.rolesRemovedOnDenial),
		acceptPresets: readPresets(raw.acceptPresets),
		denyPresets: readPresets(raw.denyPresets),
		decisionEmbeds: readDecisionEmbeds(raw.decisionEmbeds),
		scoring: {
			enabled: bool(scoring.enabled),
			defaultPoints: clamp(scoring.defaultPoints ?? 1, 0, 1000),
			autoGrade: bool(scoring.autoGrade),
			minimumPoints: clamp(scoring.minimumPoints, 0, 100_000),
			showApplicants: bool(scoring.showApplicants),
			allowReview: bool(scoring.allowReview)
		}
	};
}

export function writeApplication(form: ApplicationForm): Record<string, unknown> {
	const questions = form.questions.map((question) => ({
		id: question.id,
		type: question.type,
		title: question.title.slice(0, questionTitleLimit),
		description: question.description.slice(0, questionDescriptionLimit),
		required: answerable(question.type) && question.required,
		options: hasOptions(question.type) ? question.options.slice(0, optionsPerQuestion) : [],
		imageUrl: question.imageUrl ?? '',
		selectionArea: question.selectionArea ?? { x: 0, y: 0, width: 0, height: 0 },
		validationRules: question.validationRules
	}));

	const scoring: Record<string, { points: number; correct: string[] }> = {};
	for (const question of form.questions) {
		if (!answerable(question.type)) continue;

		scoring[question.id] = {
			points: Math.max(0, Math.round(question.points)),
			correct: hasOptions(question.type)
				? question.correct.filter((entry) => question.options.includes(entry))
				: []
		};
	}

	return {
		id: form.id,
		guildID: form.guildID,
		title: form.title,
		description: form.description,
		bannerUrl: form.bannerUrl,
		themeColor: form.themeColor,
		questions,
		acceptingResponses: form.acceptingResponses,
		closedMessage: form.closedMessage,
		submittedMessage: form.submittedMessage,
		robloxRequired: form.robloxRequired,
		isBanAppeal: form.isBanAppeal,
		minimumAccountAge: form.minimumAccountAge,
		maxLogs: form.maxLogs,
		maxResponses: form.maxResponses,
		cooldown: form.cooldown,
		stageResponses: form.stageResponses,
		resultsChannel: form.resultsChannel,
		alertChannel: form.alertChannel,
		alertRoles: form.alertRoles,
		requiredRoles: form.requiredRoles,
		blacklistedRoles: form.blacklistedRoles,
		editorRoles: form.editorRoles,
		rolesAddedOnApproval: form.rolesAddedOnApproval,
		rolesRemovedOnApproval: form.rolesRemovedOnApproval,
		rolesRemovedOnDenial: form.rolesRemovedOnDenial,
		acceptPresets: form.acceptPresets,
		denyPresets: form.denyPresets,
		decisionEmbeds: {
			acceptDM: packDecisionMessage(form.decisionEmbeds.acceptDM),
			acceptPublic: packDecisionMessage(form.decisionEmbeds.acceptPublic),
			denyDM: packDecisionMessage(form.decisionEmbeds.denyDM),
			denyPublic: packDecisionMessage(form.decisionEmbeds.denyPublic)
		},
		scoring: {
			enabled: form.scoring.enabled,
			defaultPoints: Math.max(0, Math.round(form.scoring.defaultPoints)),
			autoGrade: form.scoring.autoGrade,
			minimumPoints: Math.max(0, Math.round(form.scoring.minimumPoints)),
			showApplicants: form.scoring.showApplicants,
			allowReview: form.scoring.allowReview,
			questions: scoring
		}
	};
}

function readComments(value: unknown): Comment[] {
	return list(value).map((raw, index) => ({
		id: text(raw.id) || String(index),
		discordID: text(raw.DiscordID ?? raw.discordID),
		username: text(raw.Username ?? raw.username, 'Unknown'),
		avatar: text(raw.Avatar ?? raw.avatar),
		content: text(raw.Content ?? raw.content),
		sentAt: text(raw.SentAt ?? raw.sentAt)
	}));
}

function readRoblox(value: unknown): RobloxData | null {
	if (!value || typeof value !== 'object') return null;
	const raw = value as Record<string, unknown>;
	const robloxID = num(raw.RobloxID ?? raw.robloxID);
	if (!robloxID) return null;

	return {
		username: text(raw.Username ?? raw.username),
		robloxID,
		joinDate: text(raw.JoinDate ?? raw.joinDate),
		thumbnailURL: text(raw.ThumbnailURL ?? raw.thumbnailURL)
	};
}

function readScore(raw: Record<string, unknown>): ResponseScore {
	const source = (raw.marks ?? {}) as Record<string, unknown>;
	const marks: Record<string, { earned: number; worth: number }> = {};

	for (const [key, value] of Object.entries(source)) {
		const mark = (value ?? {}) as Record<string, unknown>;
		marks[key] = { earned: num(mark.earned), worth: num(mark.worth) };
	}

	return { total: num(raw.total), max: num(raw.max), passed: bool(raw.passed), marks };
}

export function readResponse(raw: Record<string, unknown>): ApplicationResponse {
	const responses = (raw.responses ?? {}) as Record<string, unknown>;
	const answers = (responses.answers ?? {}) as Record<string, unknown>;
	const score = (responses.score ?? null) as Record<string, unknown> | null;
	const reviewer = (raw.reviewedBy ?? null) as Record<string, unknown> | null;
	const status = text(raw.reviewStatus, 'unreviewed');

	return {
		responseID: text(raw.responseID),
		applicationID: text(raw.applicationID),
		guildID: text(raw.guildID),
		username: text(raw.username, 'Unknown'),
		discordID: text(raw.discordID),
		avatar: text(raw.avatar),
		submittedAt: text(raw.submittedAt),
		reviewStatus: status === 'approved' || status === 'denied' ? status : 'unreviewed',
		staged: bool(raw.staged),
		reason: text(raw.reason),
		answers,
		score: score ? readScore(score) : null,
		roblox: readRoblox(responses.robloxData),
		comments: readComments(raw.comments),
		reviewedBy: reviewer?.discordID
			? {
					username: text(reviewer.username, 'Unknown'),
					avatar: text(reviewer.avatar),
					discordID: text(reviewer.discordID)
				}
			: null
	};
}

export interface ApplicationAccess {
	applications: ApplicationForm[];
	isApplicationReviewer: boolean;
	hasApplicationAccess: boolean;
	permissionLevel: number;
	permissionName: string;
}

export async function getApplications(
	token: string,
	guildId: string
): Promise<ApplicationAccess | null> {
	const reply = await call(token, `/${guildId}/GetAllApplications`);
	if (!reply?.ok) return null;

	const applications = list(reply.body.applications).map(readApplication);

	return {
		applications,
		isApplicationReviewer: bool(reply.body.isApplicationReviewer),
		hasApplicationAccess: bool(reply.body.hasApplicationAccess),
		permissionLevel: num(reply.body.permissionLevel),
		permissionName: text(reply.body.permissionName, 'Staff')
	};
}

export async function getApplication(
	token: string,
	guildId: string,
	applicationId: string
): Promise<ApplicationForm | null> {
	const reply = await call(token, `/${guildId}/${applicationId}/GetApplication`);
	if (!reply?.ok) return null;

	return readApplication(reply.body);
}

export async function createApplication(
	token: string,
	guildId: string,
	title: string,
	description: string
): Promise<string> {
	const reply = await call(token, `/${guildId}/CreateApplication`, 'POST', { title, description });
	if (!reply?.ok) return '';

	return text(reply.body.id);
}

export async function saveApplication(
	token: string,
	guildId: string,
	form: ApplicationForm
): Promise<string | null> {
	const reply = await call(
		token,
		`/${guildId}/${form.id}/SaveApplication`,
		'PATCH',
		writeApplication(form)
	);
	if (!reply?.ok) return reason(reply, 'Could not save this application, try again shortly.');

	return null;
}

export async function deleteApplication(
	token: string,
	guildId: string,
	applicationId: string
): Promise<string | null> {
	const reply = await call(token, `/${guildId}/${applicationId}/DeleteApplication`, 'DELETE');
	if (!reply?.ok) return reason(reply, 'Could not delete this application.');

	return null;
}

export async function getResponses(
	token: string,
	guildId: string,
	applicationId: string
): Promise<ApplicationResponse[] | null> {
	const reply = await call(token, `/${guildId}/${applicationId}/GetAllResponses`);
	if (!reply?.ok) return null;

	return list(reply.body.responses).map(readResponse);
}

export async function getUserResponses(
	token: string,
	guildId: string,
	applicationId: string
): Promise<ApplicationResponse[]> {
	const reply = await call(token, `/${guildId}/${applicationId}/GetUserApplications`);
	if (!reply?.ok) return [];

	return list(reply.body.applications).map(readResponse);
}

export async function submitResponse(
	token: string,
	guildId: string,
	applicationId: string,
	body: Record<string, unknown>
): Promise<string | null> {
	const reply = await call(token, `/${guildId}/${applicationId}/SubmitResponse`, 'POST', body);
	if (!reply?.ok) return reason(reply, 'Could not send your application, try again shortly.');

	return null;
}

export async function reviewResponse(
	token: string,
	guildId: string,
	responseId: string,
	status: 'approved' | 'denied',
	reviewReason: string,
	staged: boolean
): Promise<string | null> {
	const path = status === 'approved' ? 'ApproveApplication' : 'DenyApplication';
	const reply = await call(token, `/${guildId}/${responseId}/${path}`, 'POST', {
		reason: reviewReason,
		staged
	});
	if (!reply?.ok) return reason(reply, 'Could not update that response.');

	return null;
}

export async function commentOnResponse(
	token: string,
	guildId: string,
	responseId: string,
	content: string
): Promise<string | null> {
	const reply = await call(token, `/${guildId}/${responseId}/AddComment`, 'POST', { content });
	if (!reply?.ok) return reason(reply, 'Could not post that comment.');

	return null;
}

export async function deleteResponse(
	token: string,
	guildId: string,
	responseId: string
): Promise<string | null> {
	const reply = await call(token, `/${guildId}/${responseId}/DeleteResponse`, 'DELETE');
	if (!reply?.ok) return reason(reply, 'Could not delete that response.');

	return null;
}

export async function publishStaged(
	token: string,
	guildId: string,
	applicationId: string
): Promise<string | null> {
	const reply = await call(token, `/${guildId}/${applicationId}/UnstageAllResponses`, 'POST');
	if (!reply?.ok) return reason(reply, 'Could not publish those results.');

	return null;
}

export async function getUserRoles(
	token: string,
	guildId: string,
	userId: string
): Promise<string[] | null> {
	const reply = await call(token, `/${guildId}/${userId}/GetUserRoles`);
	if (!reply?.ok) return null;

	return ids(reply.body.roles);
}

export async function getRobloxData(token: string): Promise<RobloxData | null> {
	const reply = await call(token, '/Users/Roblox');
	if (!reply?.ok) return null;

	return readRoblox(reply.body);
}

export async function getBans(
	token: string,
	guildId: string
): Promise<{ id: string; name: string }[] | null> {
	const reply = await call(token, `/${guildId}/GetERLCBans`);
	if (!reply?.ok) return null;

	return list(reply.body.Bans).map((raw) => ({
		id: text(raw.PlayerId),
		name: text(raw.PlayerName)
	}));
}

export async function getErlcPlayers(token: string, guildId: string): Promise<LiveRoster> {
	const reply = await call(token, `/${guildId}/GetERLCPlayers`);

	if (!reply?.ok) {
		const message = text(reply?.body.message);
		const unconfigured = /server key/i.test(message) || reply?.status === 400;

		return { players: [], offline: false, unconfigured };
	}

	const players = list(reply.body.Players).map((raw) => ({
		name: text(raw.PlayerName) || text(raw.Player).split(':')[0],
		id: text(raw.UserID),
		team: text(raw.Team, 'Civilian')
	}));

	return { players, offline: !players.length, unconfigured: false };
}
