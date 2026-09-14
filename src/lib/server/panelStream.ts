import { env } from '$env/dynamic/private';
import {
	cachedIssues,
	cachedLogs,
	loadModerations,
	loadMyHistory,
	loadMyShift,
	loadPriorities,
	loadRequests,
	loadServer,
	loadShifts,
	refreshLogs
} from './panel';

export const sections = [
	'server',
	'logs',
	'shifts',
	'moderations',
	'priorities',
	'requests',
	'mine',
	'status',
	'announcement'
] as const;

export type Section = (typeof sections)[number];

type Send = (section: Section, payload: unknown) => void;

interface Listener {
	token: string;
	discordId: string;
	send: Send;
	mine: string;
	turn: number;
}

interface Guild {
	listeners: Set<Listener>;
	connected: boolean;
	shared: Partial<Record<Section, unknown>>;
	serial: Partial<Record<Section, string>>;
	ticket: Partial<Record<Section, number>>;
	queued: Set<Section>;
	debounce: ReturnType<typeof setTimeout> | null;
	timers: ReturnType<typeof setInterval>[];
	controller: AbortController;
	closed: boolean;
	ready: Promise<void>;
}

const debounceDelay = 700;
const serverInterval = 10_000;
const logInterval = 60_000;
const restInterval = 60_000;
const retryFloor = 5_000;
const retryCeiling = 60_000;

const shared: Section[] = ['server', 'logs', 'shifts', 'moderations', 'priorities', 'requests'];

const triggers: Record<string, Section[]> = {
	createModeration: ['moderations'],
	updateModeration: ['moderations'],
	deleteModeration: ['moderations'],
	startShift: ['shifts', 'mine'],
	endShift: ['shifts', 'mine'],
	toggleBreak: ['shifts', 'mine'],
	voidShift: ['shifts', 'mine'],
	newPriority: ['priorities'],
	priorityUpdated: ['priorities'],
	priorityDeleted: ['priorities'],
	newStaffRequest: ['requests'],
	newAssistanceRequest: ['requests']
};

const guilds = new Map<string, Guild>();

function announce(guild: Guild, guildId: string, connected: boolean, reason = '') {
	if (guild.connected === connected) return;

	guild.connected = connected;
	if (!connected) console.warn(`panel stream ${guildId} disconnected:`, reason || 'closed');

	for (const listener of guild.listeners) listener.send('status', { connected });
}

function token(guild: Guild): string {
	for (const listener of guild.listeners) if (listener.token) return listener.token;
	return '';
}

async function build(guild: Guild, guildId: string, section: Section): Promise<unknown> {
	const key = token(guild);

	if (section === 'server') return loadServer(key, guildId);
	if (section === 'logs') {
		await refreshLogs(key, guildId);
		return { entries: cachedLogs(guildId), issues: cachedIssues(guildId) };
	}
	if (section === 'shifts') return loadShifts(key, guildId);
	if (section === 'moderations') return loadModerations(key, guildId);
	if (section === 'priorities') return loadPriorities(key, guildId);

	return loadRequests(key, guildId);
}

async function refresh(guild: Guild, guildId: string, section: Section) {
	if (guild.closed || !guild.listeners.size) return;

	const turn = (guild.ticket[section] ?? 0) + 1;
	guild.ticket[section] = turn;

	const payload = await build(guild, guildId, section);
	const serial = JSON.stringify(payload);

	if (guild.closed || guild.ticket[section] !== turn) return;

	guild.shared[section] = payload;
	if (guild.serial[section] === serial) return;

	guild.serial[section] = serial;
	for (const listener of guild.listeners) listener.send(section, payload);
}

async function refreshMine(guild: Guild, guildId: string, listener: Listener) {
	if (guild.closed) return;

	const turn = listener.turn + 1;
	listener.turn = turn;

	const [myShift, myHistory] = await Promise.all([
		loadMyShift(listener.token, guildId),
		loadMyHistory(listener.token, guildId, listener.discordId)
	]);

	const payload = { myShift, myHistory };
	const serial = JSON.stringify(payload);
	if (guild.closed || listener.turn !== turn || listener.mine === serial) return;

	listener.mine = serial;
	listener.send('mine', payload);
}

function run(guild: Guild, guildId: string, wanted: Section[]) {
	for (const section of wanted) guild.queued.add(section);
	if (guild.debounce) return;

	guild.debounce = setTimeout(() => {
		guild.debounce = null;

		const due = [...guild.queued];
		guild.queued.clear();

		for (const section of due) {
			if (section === 'mine') {
				for (const listener of guild.listeners) {
					void refreshMine(guild, guildId, listener).catch(() => null);
				}
				continue;
			}

			void refresh(guild, guildId, section).catch((error) =>
				console.warn(`panel ${section} ${guildId} failed:`, error)
			);
		}
	}, debounceDelay);
}

async function consume(guild: Guild, guildId: string, body: NonNullable<Response['body']>) {
	const reader = body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = '';

	while (!guild.closed) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += value;
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';

		for (const line of lines) {
			if (!line.startsWith('data: ')) continue;

			const frame = JSON.parse(line.slice(6)) as { action?: unknown; data?: unknown };
			const action = String(frame.action ?? '');

			if (action === 'globalMessage') {
				for (const listener of guild.listeners) listener.send('announcement', frame.data);
				continue;
			}

			const wanted = triggers[action];
			if (wanted) run(guild, guildId, wanted);
		}
	}
}

async function listen(guild: Guild, guildId: string) {
	let backoff = retryFloor;

	while (!guild.closed) {
		try {
			const key = token(guild);
			if (!key || !env.VITE_INTERNAL_URL) break;

			const response = await fetch(
				`${env.VITE_INTERNAL_URL}/sse/${guildId}?token=${encodeURIComponent(key)}`,
				{
					headers: { accept: 'text/event-stream' },
					signal: guild.controller.signal
				}
			);

			if (!response.ok || !response.body) {
				announce(guild, guildId, false, String(response.status));
			} else {
				announce(guild, guildId, true);
				backoff = retryFloor;
				await consume(guild, guildId, response.body);
			}
		} catch (error) {
			if (guild.closed) return;
			announce(guild, guildId, false, (error as Error).message);
		}

		if (guild.closed) return;

		announce(guild, guildId, false);
		await new Promise((resolve) => setTimeout(resolve, backoff));
		backoff = Math.min(retryCeiling, backoff * 2);
	}

	announce(guild, guildId, false);
}

function open(): Guild {
	return {
		listeners: new Set(),
		connected: false,
		shared: {},
		serial: {},
		ticket: {},
		queued: new Set(),
		debounce: null,
		timers: [],
		controller: new AbortController(),
		closed: false,
		ready: Promise.resolve()
	};
}

function start(guild: Guild, guildId: string) {
	guild.ready = Promise.all(shared.map((section) => refresh(guild, guildId, section))).then(
		() => undefined
	);

	guild.timers = [
		setInterval(() => void refresh(guild, guildId, 'server').catch(() => null), serverInterval),
		setInterval(() => void refresh(guild, guildId, 'logs').catch(() => null), logInterval),
		setInterval(() => {
			for (const section of ['shifts', 'moderations', 'priorities', 'requests'] as Section[]) {
				void refresh(guild, guildId, section).catch(() => null);
			}
			for (const listener of guild.listeners) {
				void refreshMine(guild, guildId, listener).catch(() => null);
			}
		}, restInterval)
	];

	void listen(guild, guildId);
}

function close(guildId: string, guild: Guild) {
	guild.closed = true;
	guild.controller.abort();

	for (const timer of guild.timers) clearInterval(timer);
	if (guild.debounce) clearTimeout(guild.debounce);

	if (guilds.get(guildId) === guild) guilds.delete(guildId);
}

export const refreshable: Section[] = [...shared, 'mine'];

export function request(guildId: string, wanted: Section[]): boolean {
	const guild = guilds.get(guildId);
	const due = wanted.filter((section) => refreshable.includes(section));

	if (!guild || guild.closed || !due.length) return false;

	run(guild, guildId, due);

	return true;
}

export function subscribe(
	token: string,
	guildId: string,
	discordId: string,
	send: Send
): () => void {
	const existing = guilds.get(guildId);
	const current = existing ?? open();

	const listener: Listener = { token, discordId, send, mine: '', turn: 0 };
	current.listeners.add(listener);

	if (!existing) {
		guilds.set(guildId, current);
		start(current, guildId);
	}

	void current.ready
		.then(() => {
			if (!current.listeners.has(listener)) return;

			send('status', { connected: current.connected });

			for (const section of shared) {
				if (current.shared[section] !== undefined) send(section, current.shared[section]);
			}

			return refreshMine(current, guildId, listener);
		})
		.catch(() => null);

	return () => {
		if (!current.listeners.delete(listener)) return;
		if (!current.listeners.size) close(guildId, current);
	};
}
