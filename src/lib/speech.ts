import { browser } from '$app/environment';

export interface Recogniser {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	start(): void;
	stop(): void;
	abort(): void;
	onresult: ((event: RecogniserEvent) => void) | null;
	onerror: ((event: { error: string; message?: string }) => void) | null;
	onstart: (() => void) | null;
	onend: (() => void) | null;
}

export interface Alternative {
	transcript: string;
	confidence: number;
}

export interface RecogniserResult extends ArrayLike<Alternative> {
	isFinal: boolean;
}

export interface RecogniserEvent {
	results: ArrayLike<RecogniserResult>;
}

type RecogniserConstructor = new () => Recogniser;

function available(): RecogniserConstructor | null {
	if (!browser) return null;

	const scope = window as unknown as {
		SpeechRecognition?: RecogniserConstructor;
		webkitSpeechRecognition?: RecogniserConstructor;
	};

	return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
	return available() !== null;
}

export function createRecogniser(): Recogniser | null {
	const Recognition = available();
	return Recognition ? new Recognition() : null;
}

function readPref(key: string): string {
	if (!browser) return '';

	try {
		return localStorage.getItem(key) ?? '';
	} catch {
		return '';
	}
}

function writePref(key: string, value: string) {
	if (!browser) return;

	try {
		localStorage.setItem(key, value);
	} catch {
		return;
	}
}

const deviceKeys = { mic: 'panelSpeechMic', speaker: 'panelSpeechSpeaker' } as const;

export type DeviceKind = keyof typeof deviceKeys;

export function storedDevice(kind: DeviceKind): string {
	return readPref(deviceKeys[kind]);
}

export function storeDevice(kind: DeviceKind, id: string) {
	writePref(deviceKeys[kind], id);
}

const listenKey = 'panelSpeechListening';

export function storedListening(): boolean {
	return readPref(listenKey) === '1';
}

export function storeListening(on: boolean) {
	writePref(listenKey, on ? '1' : '0');
}

const diagnosticsKey = 'panelSpeechDiagnostics';

export function storedDiagnostics(): boolean {
	return readPref(diagnosticsKey) === '1';
}

export function storeDiagnostics(on: boolean) {
	writePref(diagnosticsKey, on ? '1' : '0');
}

const langKey = 'panelSpeechLang';

const langLabels: [string, string][] = [
	['en-US', 'English (United States)'],
	['en-GB', 'English (United Kingdom)'],
	['en-AU', 'English (Australia)'],
	['en-CA', 'English (Canada)']
];

export function defaultLang(): string {
	return (browser && navigator.language) || 'en-US';
}

export function storedLang(): string {
	return readPref(langKey) || defaultLang();
}

export function storeLang(lang: string) {
	writePref(langKey, lang);
}

export function langOptions(): { value: string; label: string }[] {
	const options = langLabels.map(([value, label]) => ({ value, label }));
	const browserLang = defaultLang();

	if (!options.some((option) => option.value === browserLang)) {
		options.unshift({ value: browserLang, label: `${browserLang} (browser default)` });
	}

	return options;
}

export interface PunishRequest {
	id: string;
	username: string;
	type: string;
	reason: string;
}

export interface Command {
	player: string;
	spokenPlayer: string;
	type: string;
	reason: string;
}

const matchFloor = 0.5;

function score(input: string, candidate: string): number {
	if (input === candidate) return 1;
	if (candidate.startsWith(input)) return 0.9;
	if (candidate.includes(input)) return 0.75;

	let hits = 0;
	let at = -1;

	for (const character of input) {
		const next = candidate.indexOf(character, at + 1);
		if (next < 0) continue;

		at = next;
		hits += 1;
	}

	return hits / Math.max(input.length, candidate.length);
}

export function bestMatch(spoken: string, options: string[]): string {
	const input = spoken.trim().toLowerCase();
	if (!input) return '';

	let best = '';
	let highest = 0;

	for (const option of options) {
		const value = score(input, option.toLowerCase());
		if (value <= highest) continue;

		highest = value;
		best = option;
	}

	return highest >= matchFloor ? best : '';
}

export type InfoTopic = 'shift' | 'requests' | 'priorities' | 'staff' | 'stats' | 'time';

export type CommandName = InfoTopic | 'moderate' | 'startShift' | 'endShift' | 'breakShift';

export interface CommandMatch {
	name: CommandName;
	score: number;
}

export interface CommandSpec {
	name: CommandName;
	action: string;
	phrases: string[];
}

export const commands: CommandSpec[] = [
	{
		name: 'startShift',
		action: 'start your shift',
		phrases: [
			'start my shift',
			'start a shift',
			'start shift',
			'begin my shift',
			'clock in',
			'start duty'
		]
	},
	{
		name: 'endShift',
		action: 'end your shift',
		phrases: [
			'end my shift',
			'end shift',
			'end my duty',
			'finish my shift',
			'stop my shift',
			'clock out',
			'go off duty',
			'sign off'
		]
	},
	{
		name: 'breakShift',
		action: 'start your break',
		phrases: [
			'go on break',
			'going on break',
			'take a break',
			'brb',
			'be right back',
			'back from break',
			'end my break',
			'resume my shift'
		]
	},
	{
		name: 'shift',
		action: 'check your shift',
		phrases: [
			'my shift',
			'am i on duty',
			'am i on shift',
			'am i on break',
			'my time',
			'how long have i'
		]
	},
	{
		name: 'priorities',
		action: 'get active priority requests',
		phrases: ['priority requests', 'priority', 'priorities', 'open priorities', 'pending']
	},
	{
		name: 'requests',
		action: 'get staff requests',
		phrases: ['staff requests', 'staff request', 'requests', 'assistance']
	},
	{
		name: 'moderate',
		action: 'punish a user',
		phrases: [
			'moderate',
			'moderation',
			'punish',
			'warn',
			'warning',
			'kick',
			'ban',
			'bolo',
			'moderate a user',
			'punish a user',
			'warn a user',
			'kick a user',
			'ban a user',
			'log a moderation'
		]
	},
	{
		name: 'stats',
		action: 'check the server stats',
		phrases: [
			'server stats',
			'server',
			'stats',
			'statistics',
			'server status',
			'players',
			'player count',
			'population',
			'how many players',
			'how many people',
			'who is playing'
		]
	},
	{
		name: 'staff',
		action: 'check who is on duty',
		phrases: [
			'staff on duty',
			'staff',
			'duty',
			'on duty',
			'staff on',
			'working',
			'online',
			'shifts',
			'who is on',
			'how many staff'
		]
	},
	{
		name: 'time',
		action: 'check the time',
		phrases: ['the time', 'time', 'clock', 'what time', 'hour']
	}
];

export const commandInfo = Object.fromEntries(
	commands.map((entry) => [entry.name, { phrase: entry.phrases[0], action: entry.action }])
) as Record<CommandName, { phrase: string; action: string }>;

const spanLimit = 4;

export const commandFloors = { accept: 2, maybe: 1 } as const;

function normalise(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s]+/g, '')
		.split(/\s+/)
		.filter(Boolean);
}

function joins(words: string[]): string[] {
	const list: string[] = [];

	for (let at = 0; at < words.length; at += 1) {
		for (let span = 1; span <= spanLimit && at + span <= words.length; span += 1) {
			list.push(words.slice(at, at + span).join(''));
		}
	}

	return list;
}

function distance(input: string, candidate: string): number {
	let row = Array.from({ length: candidate.length + 1 }, (_, at) => at);

	for (let index = 0; index < input.length; index += 1) {
		const next = [index + 1];

		for (let at = 0; at < candidate.length; at += 1) {
			const swap = row[at] + (input[index] === candidate[at] ? 0 : 1);
			next.push(Math.min(swap, row[at + 1] + 1, next[at] + 1));
		}

		row = next;
	}

	return row[candidate.length];
}

function tolerance(length: number): number {
	return length <= 4 ? 0 : Math.min(2, Math.floor(length / 3));
}

function alike(word: string, target: string): boolean {
	const limit = tolerance(target.length);
	if (Math.abs(word.length - target.length) > limit) return false;

	return distance(word, target) <= limit;
}

function weigh(phrase: string): number {
	return phrase.split(' ').length + (phrase.replace(/ /g, '').length >= 6 ? 1 : 0);
}

export function matchCommand(text: string): CommandMatch | null {
	const spans = joins(normalise(text));
	if (!spans.length) return null;

	let best: CommandMatch | null = null;

	for (const { name, phrases } of commands) {
		let score = 0;

		for (const phrase of phrases) {
			const target = phrase.replace(/ /g, '');

			if (spans.includes(target)) score += weigh(phrase) + 1;
			else if (spans.some((span) => alike(span, target))) score += weigh(phrase);
		}

		if (score < commandFloors.maybe || (best && score <= best.score)) continue;

		best = { name, score };
	}

	return best;
}

const affirmatives = ['yes', 'yeah', 'yep', 'yup', 'correct', 'confirm', 'do it', 'sure'];
const negatives = ['no', 'nope', 'nah', 'cancel', 'never mind', 'nevermind', 'stop'];

function answerScore(spans: string[], options: string[]): number {
	let hits = 0;

	for (const option of options) {
		const target = option.replace(/ /g, '');

		if (spans.includes(target)) hits += 2;
		else if (spans.some((span) => alike(span, target))) hits += 1;
	}

	return hits;
}

export function matchAnswer(text: string): boolean | null {
	const spans = joins(normalise(text));
	if (!spans.length) return null;

	const yes = answerScore(spans, affirmatives);
	const no = answerScore(spans, negatives);

	return yes === no ? null : yes > no;
}

export function chooseType(text: string, types: string[]): { type: string; spoken: string } {
	const words = normalise(text);
	const spoken = words.join(' ').match(/\b(?:as|type)\s+(?:an?\s+|the\s+)?(.+)$/)?.[1] ?? '';
	const spans = joins(words);

	for (const option of types) {
		const target = option.toLowerCase().replace(/[^a-z0-9]+/g, '');
		const named = spans.some(
			(span) => alike(span, target) || (span.length >= 4 && target.startsWith(span))
		);

		if (named) return { type: option, spoken };
	}

	return { type: '', spoken };
}

export const wakeWord = 'copilot';

const wakeTolerance = 2;
const wakeSpan = 3;

const wakeVariants = new Set([
	'copilot',
	'copilots',
	'kopilot',
	'copilate',
	'copylot',
	'copylight',
	'cobalt',
	'copealot',
	'coppola',
	'copileit',
	'capital',
	'capitol'
]);

function letters(word: string): string {
	return word.toLowerCase().replace(/[^a-z]/g, '');
}

function wakeLike(word: string): boolean {
	if (!word) return false;
	if (wakeVariants.has(word)) return true;
	if (Math.abs(word.length - wakeWord.length) > wakeTolerance) return false;

	return distance(word, wakeWord) <= wakeTolerance;
}

export function extractCommand(text: string): string | null {
	const words = text.split(/\s+/).filter(Boolean);

	for (let at = 0; at < words.length; at += 1) {
		for (let span = 1; span <= wakeSpan && at + span <= words.length; span += 1) {
			if (!wakeLike(letters(words.slice(at, at + span).join('')))) continue;

			return words
				.slice(at + span)
				.join(' ')
				.replace(/^[\s,.]+/, '')
				.trim();
		}
	}

	return null;
}

export function wakeGap(text: string): number {
	const words = text.split(/\s+/).filter(Boolean);

	let closest = Number.POSITIVE_INFINITY;

	for (let at = 0; at < words.length; at += 1) {
		for (let span = 1; span <= wakeSpan && at + span <= words.length; span += 1) {
			const joined = letters(words.slice(at, at + span).join(''));
			if (joined) closest = Math.min(closest, distance(joined, wakeWord));
		}
	}

	return closest;
}

const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

export function listOf(items: string[]): string {
	return listFormat.format(items);
}

export function spokenCount(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function spokenDuration(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	if (total < 60) return spokenCount(total, 'second');

	const minutes = Math.floor(total / 60);
	if (minutes < 60) return spokenCount(minutes, 'minute');

	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (!rest) return spokenCount(hours, 'hour');

	return `${spokenCount(hours, 'hour')} and ${spokenCount(rest, 'minute')}`;
}
