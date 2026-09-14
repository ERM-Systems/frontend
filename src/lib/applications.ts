import AlignLeft from '@lucide/svelte/icons/align-left';
import AtSign from '@lucide/svelte/icons/at-sign';
import CalendarDays from '@lucide/svelte/icons/calendar-days';
import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
import CircleDot from '@lucide/svelte/icons/circle-dot';
import Clock from '@lucide/svelte/icons/clock';
import Hash from '@lucide/svelte/icons/hash';
import Heading from '@lucide/svelte/icons/heading';
import Link from '@lucide/svelte/icons/link';
import MousePointerClick from '@lucide/svelte/icons/mouse-pointer-click';
import Phone from '@lucide/svelte/icons/phone';
import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
import SquareCheck from '@lucide/svelte/icons/square-check';
import Star from '@lucide/svelte/icons/star';
import Type from '@lucide/svelte/icons/type';
import { blankMessage, type DiscordMessage } from './discord';
import type { MessageVariable } from './settings';

export type QuestionType =
	| 'section'
	| 'short'
	| 'long'
	| 'number'
	| 'multiple'
	| 'checkbox'
	| 'dropdown'
	| 'calendar'
	| 'time'
	| 'email'
	| 'phone'
	| 'url'
	| 'rating'
	| 'range'
	| 'image_selection';

export interface QuestionKind {
	value: QuestionType;
	label: string;
	description: string;
	group: string;
	icon: typeof Type;
	options: boolean;
	answerable: boolean;
	legacy?: boolean;
}

export const questionKinds: QuestionKind[] = [
	{
		value: 'short',
		label: 'Short answer',
		description: 'A single line of text.',
		group: 'Text',
		icon: Type,
		options: false,
		answerable: true
	},
	{
		value: 'long',
		label: 'Paragraph',
		description: 'A longer written answer.',
		group: 'Text',
		icon: AlignLeft,
		options: false,
		answerable: true
	},
	{
		value: 'multiple',
		label: 'Multiple choice',
		description: 'Pick exactly one option.',
		group: 'Choice',
		icon: CircleDot,
		options: true,
		answerable: true
	},
	{
		value: 'checkbox',
		label: 'Checkboxes',
		description: 'Pick any number of options.',
		group: 'Choice',
		icon: SquareCheck,
		options: true,
		answerable: true
	},
	{
		value: 'dropdown',
		label: 'Dropdown',
		description: 'Pick one option from a list.',
		group: 'Choice',
		icon: ChevronsUpDown,
		options: true,
		answerable: true
	},
	{
		value: 'number',
		label: 'Number',
		description: 'A numeric answer.',
		group: 'Scales',
		icon: Hash,
		options: false,
		answerable: true
	},
	{
		value: 'rating',
		label: 'Rating',
		description: 'A one to five star rating.',
		group: 'Scales',
		icon: Star,
		options: false,
		answerable: true
	},
	{
		value: 'range',
		label: 'Slider',
		description: 'A value on a sliding scale.',
		group: 'Scales',
		icon: SlidersHorizontal,
		options: false,
		answerable: true
	},
	{
		value: 'calendar',
		label: 'Date',
		description: 'A calendar date.',
		group: 'Date',
		icon: CalendarDays,
		options: false,
		answerable: true
	},
	{
		value: 'time',
		label: 'Time',
		description: 'A time of day.',
		group: 'Date',
		icon: Clock,
		options: false,
		answerable: true
	},
	{
		value: 'email',
		label: 'Email',
		description: 'An email address.',
		group: 'Contact',
		icon: AtSign,
		options: false,
		answerable: true
	},
	{
		value: 'phone',
		label: 'Phone number',
		description: 'A phone number.',
		group: 'Contact',
		icon: Phone,
		options: false,
		answerable: true
	},
	{
		value: 'url',
		label: 'Link',
		description: 'A web address.',
		group: 'Contact',
		icon: Link,
		options: false,
		answerable: true
	},
	{
		value: 'image_selection',
		label: 'Image selection',
		description: 'Click the right spot on an image.',
		group: 'Media',
		icon: MousePointerClick,
		options: false,
		answerable: true
	},
	{
		value: 'section',
		label: 'Section',
		description: 'A heading that splits the form up.',
		group: 'Layout',
		icon: Heading,
		options: false,
		answerable: false
	}
];

export const questionGroups = [...new Set(questionKinds.map((kind) => kind.group))];

export function questionKind(type: QuestionType): QuestionKind {
	return questionKinds.find((kind) => kind.value === type) ?? questionKinds[0];
}

export function answerable(type: QuestionType): boolean {
	return type !== 'section';
}

export function hasOptions(type: QuestionType): boolean {
	return type === 'multiple' || type === 'checkbox' || type === 'dropdown';
}

export type ValidationType =
	| 'length'
	| 'words'
	| 'sentences'
	| 'range'
	| 'regex'
	| 'contains'
	| 'excludes'
	| 'startsWith'
	| 'endsWith'
	| 'customList'
	| 'dateRange'
	| 'choiceCount';

export interface ValidationParams {
	minLength?: number;
	maxLength?: number;
	minWords?: number;
	maxWords?: number;
	minSentences?: number;
	minValue?: number;
	maxValue?: number;
	pattern?: string;
	text?: string;
	allowedValues?: string[];
	minDate?: string;
	maxDate?: string;
	minChoices?: number;
	maxChoices?: number;
	caseSensitive?: boolean;
}

export interface ValidationRule {
	id: string;
	type: ValidationType;
	params: ValidationParams;
	errorMessage: string;
}

export interface ValidationKind {
	value: ValidationType;
	label: string;
	description: string;
	types: QuestionType[];
}

const textTypes: QuestionType[] = ['short', 'long', 'email', 'phone', 'url'];
const numberTypes: QuestionType[] = ['number', 'rating', 'range'];

export const validationKinds: ValidationKind[] = [
	{
		value: 'length',
		label: 'Character count',
		description: 'Keep the answer within a number of characters.',
		types: textTypes
	},
	{
		value: 'words',
		label: 'Word count',
		description: 'Keep the answer within a number of words.',
		types: ['short', 'long']
	},
	{
		value: 'sentences',
		label: 'Sentence count',
		description: 'Ask for a minimum number of sentences.',
		types: ['long']
	},
	{
		value: 'range',
		label: 'Number range',
		description: 'Keep the answer between two values.',
		types: numberTypes
	},
	{
		value: 'regex',
		label: 'Pattern',
		description: 'Match a regular expression.',
		types: textTypes
	},
	{
		value: 'contains',
		label: 'Must contain',
		description: 'The answer has to include some text.',
		types: textTypes
	},
	{
		value: 'excludes',
		label: 'Must not contain',
		description: 'The answer cannot include some text.',
		types: textTypes
	},
	{
		value: 'startsWith',
		label: 'Starts with',
		description: 'The answer has to start with some text.',
		types: textTypes
	},
	{
		value: 'endsWith',
		label: 'Ends with',
		description: 'The answer has to end with some text.',
		types: textTypes
	},
	{
		value: 'customList',
		label: 'Allowed answers',
		description: 'Only accept one of a list of answers.',
		types: textTypes
	},
	{
		value: 'dateRange',
		label: 'Date range',
		description: 'Keep the date between two days.',
		types: ['calendar']
	},
	{
		value: 'choiceCount',
		label: 'Choice count',
		description: 'Limit how many boxes can be ticked.',
		types: ['checkbox']
	}
];

export function validationsFor(type: QuestionType): ValidationKind[] {
	return validationKinds.filter((kind) => kind.types.includes(type));
}

export interface SelectionArea {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ImageAnswer {
	isCorrect?: boolean;
	coordinates: { x: number; y: number };
}

export interface Question {
	id: string;
	type: QuestionType;
	title: string;
	description: string;
	required: boolean;
	options: string[];
	correct: string[];
	points: number;
	validationRules: ValidationRule[];
	imageUrl?: string;
	selectionArea?: SelectionArea;
}

export function imagePoint(value: unknown): { x: number; y: number } | null {
	const point = (value as ImageAnswer | null)?.coordinates;
	if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

	return { x: point.x, y: point.y };
}

export interface Preset {
	name: string;
	value: string;
}

export interface Scoring {
	enabled: boolean;
	defaultPoints: number;
	autoGrade: boolean;
	minimumPoints: number;
	showApplicants: boolean;
	allowReview: boolean;
}

export interface ApplicationDecisionEmbeds {
	acceptDM: DiscordMessage;
	acceptPublic: DiscordMessage;
	denyDM: DiscordMessage;
	denyPublic: DiscordMessage;
}

export const applicationVariables: MessageVariable[] = [
	{ token: '{user}', description: 'Mentions the applicant' },
	{ token: '{user.name}', description: 'Their username' },
	{ token: '{user.id}', description: 'Their user ID' },
	{ token: '{user.tag}', description: 'Their full tag' },
	{ token: '{application}', description: 'Application name' },
	{ token: '{status}', description: 'Accepted or Denied', example: 'Accepted' },
	{
		token: '{reason}',
		description: 'Reviewer note, or N/A',
		example: 'Great answers, welcome to the team'
	},
	{ token: '{guild}', description: 'Server name' },
	{ token: '{guild.id}', description: 'Server ID' },
	{
		token: '{guild.icon}',
		description: 'Server icon URL',
		example: 'https://cdn.discordapp.com/...'
	},
	{ token: '{submitted}', description: 'When they applied', example: '24 August 2026 19:04' },
	{ token: '{submitted.relative}', description: 'Relative submit time', example: '2 hours ago' }
];

export function blankDecisionEmbeds(): ApplicationDecisionEmbeds {
	return {
		acceptDM: blankMessage(),
		acceptPublic: blankMessage(),
		denyDM: blankMessage(),
		denyPublic: blankMessage()
	};
}

export interface ApplicationForm {
	id: string;
	guildID: string;
	title: string;
	description: string;
	bannerUrl: string;
	themeColor: string;
	questions: Question[];
	acceptingResponses: boolean;
	closedMessage: string;
	submittedMessage: string;
	robloxRequired: boolean;
	isBanAppeal: boolean;
	minimumAccountAge: number;
	maxLogs: number;
	maxResponses: number;
	cooldown: number;
	stageResponses: boolean;
	resultsChannel: string;
	alertChannel: string;
	alertRoles: string[];
	requiredRoles: string[];
	blacklistedRoles: string[];
	editorRoles: string[];
	rolesAddedOnApproval: string[];
	rolesRemovedOnApproval: string[];
	rolesRemovedOnDenial: string[];
	acceptPresets: Preset[];
	denyPresets: Preset[];
	decisionEmbeds: ApplicationDecisionEmbeds;
	scoring: Scoring;
}

export interface ApplicationSummary {
	id: string;
	title: string;
	description: string;
	acceptingResponses: boolean;
	questionCount: number;
	responseCount: number;
	pending: number;
	themeColor: string;
}

export interface ResponseScore {
	total: number;
	max: number;
	passed: boolean;
	marks: Record<string, { earned: number; worth: number }>;
}

export interface Comment {
	id: string;
	discordID: string;
	username: string;
	avatar: string;
	content: string;
	sentAt: string;
}

export interface LivePlayer {
	name: string;
	id: string;
	team: string;
}

export interface LiveRoster {
	players: LivePlayer[];
	offline: boolean;
	unconfigured: boolean;
}

export interface RobloxData {
	username: string;
	robloxID: number;
	joinDate: string;
	thumbnailURL: string;
}

export interface ApplicationResponse {
	responseID: string;
	applicationID: string;
	guildID: string;
	username: string;
	discordID: string;
	avatar: string;
	submittedAt: string;
	reviewStatus: 'unreviewed' | 'approved' | 'denied';
	staged: boolean;
	reason: string;
	answers: Record<string, unknown>;
	score: ResponseScore | null;
	roblox: RobloxData | null;
	comments: Comment[];
	reviewedBy: { username: string; avatar: string; discordID: string } | null;
}

export const titleLimit = 100;
export const descriptionLimit = 2000;
export const questionTitleLimit = 300;
export const questionDescriptionLimit = 1000;
export const optionLimit = 100;
export const optionsPerQuestion = 25;
export const questionLimit = 100;
export const presetLimit = 25;
export const answerLimit = 5000;
export const messageLimit = 1000;
export const maxAccountAge = 3650;
export const maxCooldown = 365;
export const responseLimit = 100;
export const ratingMax = 5;

export function newId(): string {
	return crypto.randomUUID();
}

export function blankQuestion(type: QuestionType, points = 0): Question {
	return {
		id: newId(),
		type,
		title: '',
		description: '',
		required: type !== 'section',
		options: hasOptions(type) ? ['Option 1'] : [],
		correct: [],
		points: answerable(type) ? Math.max(0, Math.round(points)) : 0,
		validationRules: []
	};
}

export function blankForm(): ApplicationForm {
	return {
		id: '',
		guildID: '',
		title: '',
		description: '',
		bannerUrl: '',
		themeColor: '#f03232',
		questions: [],
		acceptingResponses: true,
		closedMessage: '',
		submittedMessage: '',
		robloxRequired: false,
		isBanAppeal: false,
		minimumAccountAge: 0,
		maxLogs: 0,
		maxResponses: 0,
		cooldown: 0,
		stageResponses: false,
		resultsChannel: '',
		alertChannel: '',
		alertRoles: [],
		requiredRoles: [],
		blacklistedRoles: [],
		editorRoles: [],
		rolesAddedOnApproval: [],
		rolesRemovedOnApproval: [],
		rolesRemovedOnDenial: [],
		acceptPresets: [],
		denyPresets: [],
		decisionEmbeds: blankDecisionEmbeds(),
		scoring: {
			enabled: false,
			defaultPoints: 1,
			autoGrade: false,
			minimumPoints: 0,
			showApplicants: false,
			allowReview: false
		}
	};
}

function words(value: string): number {
	return value.trim().split(/\s+/).filter(Boolean).length;
}

function sentences(value: string): number {
	return value.split(/[.!?]+/).filter((part) => part.trim().length > 1).length;
}

export function isBlank(value: unknown): boolean {
	if (value === undefined || value === null || value === '') return true;
	return Array.isArray(value) && !value.length;
}

function ruleFailure(rule: ValidationRule, question: Question, value: unknown): boolean {
	const text = typeof value === 'string' ? value : '';
	const compared = rule.params.caseSensitive ? text : text.toLowerCase();
	const needle = rule.params.caseSensitive
		? (rule.params.text ?? '')
		: (rule.params.text ?? '').toLowerCase();

	switch (rule.type) {
		case 'length':
			return (
				(rule.params.minLength !== undefined && text.length < rule.params.minLength) ||
				(rule.params.maxLength !== undefined && text.length > rule.params.maxLength)
			);
		case 'words':
			return (
				(rule.params.minWords !== undefined && words(text) < rule.params.minWords) ||
				(rule.params.maxWords !== undefined && words(text) > rule.params.maxWords)
			);
		case 'sentences':
			return rule.params.minSentences !== undefined && sentences(text) < rule.params.minSentences;
		case 'range': {
			const amount = Number(value);
			if (!Number.isFinite(amount)) return true;
			return (
				(rule.params.minValue !== undefined && amount < rule.params.minValue) ||
				(rule.params.maxValue !== undefined && amount > rule.params.maxValue)
			);
		}
		case 'regex':
			try {
				return !new RegExp(rule.params.pattern ?? '').test(text);
			} catch {
				return false;
			}
		case 'contains':
			return !!needle && !compared.includes(needle);
		case 'excludes':
			return !!needle && compared.includes(needle);
		case 'startsWith':
			return !!needle && !compared.startsWith(needle);
		case 'endsWith':
			return !!needle && !compared.endsWith(needle);
		case 'customList': {
			const allowed = rule.params.allowedValues ?? [];
			if (!allowed.length) return false;
			return !allowed.some((entry) =>
				rule.params.caseSensitive ? entry === text : entry.toLowerCase() === compared
			);
		}
		case 'dateRange': {
			const stamp = Date.parse(text);
			if (!Number.isFinite(stamp)) return true;
			const min = rule.params.minDate ? Date.parse(rule.params.minDate) : NaN;
			const max = rule.params.maxDate ? Date.parse(rule.params.maxDate) : NaN;
			return (Number.isFinite(min) && stamp < min) || (Number.isFinite(max) && stamp > max);
		}
		case 'choiceCount': {
			const picked = Array.isArray(value) ? value.length : 0;
			return (
				(rule.params.minChoices !== undefined && picked < rule.params.minChoices) ||
				(rule.params.maxChoices !== undefined && picked > rule.params.maxChoices)
			);
		}
		default:
			return false;
	}
}

export function ruleMessage(rule: ValidationRule): string {
	if (rule.errorMessage.trim()) return rule.errorMessage.trim();

	const parts = rule.params;
	switch (rule.type) {
		case 'length':
			return `Keep this between ${parts.minLength ?? 0} and ${parts.maxLength ?? answerLimit} characters.`;
		case 'words':
			return `Keep this between ${parts.minWords ?? 0} and ${parts.maxWords ?? 1000} words.`;
		case 'sentences':
			return `Write at least ${parts.minSentences ?? 1} sentences.`;
		case 'range':
			return `Enter a number between ${parts.minValue ?? 0} and ${parts.maxValue ?? 100}.`;
		case 'regex':
			return 'That answer is not in the format this question expects.';
		case 'contains':
			return `This answer has to include "${parts.text ?? ''}".`;
		case 'excludes':
			return `This answer cannot include "${parts.text ?? ''}".`;
		case 'startsWith':
			return `This answer has to start with "${parts.text ?? ''}".`;
		case 'endsWith':
			return `This answer has to end with "${parts.text ?? ''}".`;
		case 'customList':
			return 'That is not one of the accepted answers.';
		case 'dateRange':
			return 'Pick a date inside the allowed range.';
		case 'choiceCount':
			return `Pick between ${parts.minChoices ?? 0} and ${parts.maxChoices ?? optionsPerQuestion} options.`;
		default:
			return 'That answer is not valid.';
	}
}

export function checkAnswer(question: Question, value: unknown): string | null {
	if (!answerable(question.type)) return null;

	if (isBlank(value)) return question.required ? 'This question is required.' : null;

	if (typeof value === 'string' && value.length > answerLimit) {
		return `Keep this under ${answerLimit} characters.`;
	}

	if (hasOptions(question.type)) {
		const picked = Array.isArray(value) ? value.map(String) : [String(value)];
		if (question.type !== 'checkbox' && picked.length > 1) return 'Pick a single option.';
		if (picked.some((entry) => !question.options.includes(entry))) {
			return 'That is not one of the options.';
		}
	}

	if (question.type === 'number' || question.type === 'range' || question.type === 'rating') {
		if (!Number.isFinite(Number(value))) return 'Enter a number.';
	}

	if (question.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value))) {
		return 'Enter a valid email address.';
	}

	if (question.type === 'phone' && !/^[+\d][\d\s()-]{5,19}$/.test(String(value))) {
		return 'Enter a valid phone number.';
	}

	if (question.type === 'url') {
		try {
			const url = new URL(String(value));
			if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'Enter a valid link.';
		} catch {
			return 'Enter a valid link.';
		}
	}

	if (question.type === 'calendar' && !Number.isFinite(Date.parse(String(value)))) {
		return 'Pick a date.';
	}

	if (question.type === 'image_selection' && !imagePoint(value)) {
		return 'Click a spot on the image.';
	}

	for (const rule of question.validationRules) {
		if (ruleFailure(rule, question, value)) return ruleMessage(rule);
	}

	return null;
}

export function checkAnswers(
	form: ApplicationForm,
	answers: Record<string, unknown>
): Record<string, string> {
	const problems: Record<string, string> = {};

	for (const question of form.questions) {
		const problem = checkAnswer(question, answers[question.id]);
		if (problem) problems[question.id] = problem;
	}

	return problems;
}

export function questionMaximum(question: Question): number {
	if (!answerable(question.type)) return 0;
	if (hasOptions(question.type) && !question.correct.length) return 0;
	if (question.type === 'image_selection' && !question.selectionArea) return 0;

	return Math.max(0, Number(question.points) || 0);
}

export function formMaximum(form: ApplicationForm): number {
	return form.questions.reduce((total, question) => total + questionMaximum(question), 0);
}

export function openEnded(form: ApplicationForm): Question[] {
	return form.questions.filter(
		(question) => answerable(question.type) && !hasOptions(question.type)
	);
}

export function publicForm(form: ApplicationForm): ApplicationForm {
	return {
		...form,
		questions: form.questions.map((question) => ({
			...question,
			points: 0,
			correct: [],
			selectionArea: undefined
		})),
		scoring: { ...form.scoring, defaultPoints: 0, minimumPoints: 0 },
		maxLogs: 0,
		resultsChannel: '',
		alertChannel: '',
		alertRoles: [],
		requiredRoles: [],
		blacklistedRoles: [],
		editorRoles: [],
		rolesAddedOnApproval: [],
		rolesRemovedOnApproval: [],
		rolesRemovedOnDenial: [],
		acceptPresets: [],
		denyPresets: [],
		decisionEmbeds: blankDecisionEmbeds()
	};
}

export function answerText(question: Question, value: unknown): string {
	if (isBlank(value)) return 'No answer';

	if (question.type === 'image_selection') {
		const point = imagePoint(value);
		if (!point) return 'No answer';

		const marked = (value as ImageAnswer).isCorrect;
		const where = `${Math.round(point.x)}%, ${Math.round(point.y)}%`;

		return marked === undefined ? where : `${where} - ${marked ? 'correct' : 'incorrect'}`;
	}

	if (Array.isArray(value)) return value.map(String).join(', ');
	if (question.type === 'rating') return `${value} / ${ratingMax}`;

	return String(value);
}

export function formPages(questions: Question[]): Question[][] {
	const pages: Question[][] = [];

	for (const question of questions) {
		if (question.type === 'section' && pages.length && pages[pages.length - 1].length) {
			pages.push([]);
		} else if (!pages.length) {
			pages.push([]);
		}

		pages[pages.length - 1].push(question);
	}

	return pages;
}

export function pageTitle(questions: Question[]): string {
	const section = questions.find((question) => question.type === 'section');

	return section?.title.trim() || 'General questions';
}
