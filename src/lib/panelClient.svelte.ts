import { SvelteDate } from 'svelte/reactivity';
import { health } from './health.svelte';
import { pushAlert } from './panel';
import { toast } from './toast.svelte';
import { playTone } from './tones';
import type {
	LogEntry,
	LogKind,
	Moderation,
	PanelOptions,
	Priority,
	Shift,
	Snapshot
} from './server/panel';
import type { PanelServer, StaffRequest } from './server/panel';

export const pollInterval = 20_000;

export const streamSections = [
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
export const refreshSections = streamSections.filter(
	(section) => section !== 'status' && section !== 'announcement'
);
export const refreshTimeout = 1_500;
export const actionCooldown = 2_000;
export const actionGap = 400;
export const announcementLimit = 20;

interface Result {
	ok: boolean;
	message: string;
	data: unknown;
}

export interface Announcement {
	id: string;
	senderId: string;
	senderName: string;
	content: string;
	timestamp: string;
}

export function blankSnapshot(): Snapshot {
	return {
		server: {
			status: 'unavailable',
			message: '',
			name: '',
			joinKey: '',
			currentPlayers: 0,
			maxPlayers: 0,
			queue: 0,
			owners: [],
			players: [],
			vehicles: [],
			fetchedAt: 0
		},
		logs: [],
		logIssues: [],
		shifts: [],
		myShift: null,
		myHistory: [],
		moderations: [],
		priorities: [],
		requests: []
	};
}

export function blankOptions(): PanelOptions {
	return { shiftTypes: [], punishmentTypes: [], presets: [], documentation: [] };
}

export class Panel {
	snapshot = $state<Snapshot>() as Snapshot;
	stale = $state(false);
	ready = $state(false);
	pending = $state<string | null>(null);

	guildId = $state('');
	level = $state(0);
	canBan = $state(false);
	me = $state('');
	focus = $state<{ id: string; username: string } | null>(null);
	announcements = $state<Announcement[]>([]);
	alerts = $state(false);

	#cooling: Record<string, number> = {};
	#last = 0;
	#seen: Record<string, string[]> = {};
	#fetching = 0;
	#applied = 0;
	#waiting: Record<string, (() => void)[]> = {};

	constructor(
		guildId: string,
		level: number,
		discordId: string,
		initial: Snapshot | null,
		canBan: boolean
	) {
		this.snapshot = blankSnapshot();
		this.sync(guildId, level, discordId, initial, canBan);
	}

	sync(
		guildId: string,
		level: number,
		discordId: string,
		snapshot: Snapshot | null,
		canBan: boolean
	) {
		this.guildId = guildId;
		this.level = level;
		this.canBan = canBan;
		this.me = discordId;

		if (!snapshot || this.ready) return;

		this.snapshot = snapshot;
		this.ready = true;
	}

	get management(): boolean {
		return this.level >= 3;
	}

	get canEditPunishments(): boolean {
		return this.level >= 2;
	}

	get base(): string {
		return `/${this.guildId}/panel/api`;
	}

	get openRequests(): number {
		return this.snapshot.requests.filter((request) => !request.acked.includes(this.me)).length;
	}

	#arrivals(section: string, ids: string[]): string[] {
		const before = this.#seen[section];
		this.#seen[section] = ids;

		if (!before) return [];
		return ids.filter((id) => !before.includes(id));
	}

	#alert(title: string, body: string) {
		if (this.alerts) pushAlert(title, body);
	}

	#apply(section: string, data: unknown) {
		if (section === 'status') {
			const live = (data as { connected: boolean }).connected;

			this.stale = !live;
			health.streaming = live;
			return;
		}

		if (section === 'announcement') {
			const announcement = data as Announcement;
			if (!announcement?.content) return;

			this.announcements = [announcement, ...this.announcements].slice(0, announcementLimit);
			if (announcement.senderId === this.me) return;

			playTone('moderation');
			this.#alert(`Announcement from ${announcement.senderName}`, announcement.content);
			return;
		}

		this.#applied = Date.now();

		if (section === 'server') this.snapshot.server = data as PanelServer;
		else if (section === 'shifts') this.snapshot.shifts = data as Shift[];
		else if (section === 'moderations') this.snapshot.moderations = data as Moderation[];
		else if (section === 'priorities') {
			const priorities = data as Priority[];
			const fresh = this.#arrivals(
				section,
				priorities.map((priority) => priority.id)
			);

			this.snapshot.priorities = priorities;
			if (fresh.length) this.#alert('New priority request', 'A priority is waiting on a decision.');
		} else if (section === 'requests') {
			const requests = data as StaffRequest[];
			const fresh = this.#arrivals(
				section,
				requests.filter((request) => !request.acked.includes(this.me)).map((request) => request.id)
			);

			this.snapshot.requests = requests;
			if (fresh.length)
				this.#alert('New staff request', 'A member is asking for staff assistance.');
		} else if (section === 'logs') {
			const logs = data as { entries: LogEntry[]; issues: LogKind[] };
			this.snapshot.logs = logs.entries;
			this.snapshot.logIssues = logs.issues;
		} else if (section === 'mine') {
			const mine = data as { myShift: Shift | null; myHistory: Shift[] };
			this.snapshot.myShift = mine.myShift;
			this.snapshot.myHistory = mine.myHistory;
		}

		this.#settle(section);
	}

	#settle(section: string) {
		const waiting = this.#waiting[section];
		if (!waiting?.length) return;

		this.#waiting[section] = [];
		for (const resolve of waiting) resolve();
	}

	#landed(section: string): Promise<void> {
		return new Promise((resolve) => {
			(this.#waiting[section] ??= []).push(resolve);
			setTimeout(resolve, refreshTimeout);
		});
	}

	async ask(sections: string[] = [...refreshSections]): Promise<void> {
		const response = await fetch(this.base, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'stream.refresh', sections })
		}).catch(() => null);

		const result = response?.ok ? await response.json().catch(() => null) : null;

		if (!result?.ok) {
			await this.refresh();
			return;
		}

		await Promise.race(sections.map((section) => this.#landed(section)));
	}

	stream(): () => void {
		const source = new EventSource(`/${this.guildId}/panel/stream`);
		let poll: ReturnType<typeof setInterval> | null = null;

		for (const section of streamSections) {
			source.addEventListener(section, (event) => {
				try {
					this.#apply(section, JSON.parse((event as MessageEvent).data));
				} catch {
					this.stale = true;
					health.streaming = false;
				}
			});
		}

		source.onopen = () => {
			if (poll) clearInterval(poll);
			poll = null;
		};

		source.onerror = () => {
			this.stale = true;
			health.streaming = false;
			if (poll) return;

			poll = setInterval(() => {
				if (!document.hidden) void this.refresh();
			}, pollInterval);
		};

		return () => {
			source.close();
			health.streaming = true;
			if (poll) clearInterval(poll);
		};
	}

	async refresh(): Promise<void> {
		const at = Date.now();
		const turn = this.#fetching + 1;
		this.#fetching = turn;

		const response = await fetch(`${this.base}?feed=snapshot`, { cache: 'no-store' }).catch(
			() => null
		);
		const snapshot = response?.ok
			? ((await response.json().catch(() => null)) as Snapshot | null)
			: null;

		if (!snapshot) {
			this.stale = true;
			return;
		}

		if (turn !== this.#fetching || this.#applied > at) return;

		this.snapshot = snapshot;
		this.stale = false;
	}

	async act(key: string, body: Record<string, unknown>): Promise<boolean> {
		if (this.pending) return false;

		const now = Date.now();
		if ((this.#cooling[key] ?? 0) > now || now - this.#last < actionGap) {
			toast('Slow down a moment before trying that again.', 'error');
			return false;
		}

		this.#cooling[key] = now + actionCooldown;
		this.#last = now;
		this.pending = key;

		try {
			const response = await fetch(this.base, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			const result = (await response.json().catch(() => null)) as Result | null;
			if (!result) {
				toast('That action failed, try again shortly.', 'error');
				return false;
			}

			toast(result.message, result.ok ? 'success' : 'error');
			if (result.ok) void this.ask();

			return result.ok;
		} catch {
			toast('That action failed, try again shortly.', 'error');
			return false;
		} finally {
			this.pending = null;
		}
	}
}

export function elapsed(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);

	if (hours) return `${hours}h ${minutes}m`;
	if (minutes) return `${minutes}m ${total % 60}s`;
	return `${total}s`;
}

export function ago(epoch: number, now: number): string {
	const diff = Math.max(0, Math.floor(now / 1000) - epoch);
	if (diff < 60) return `${diff}s ago`;
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
	return `${Math.floor(diff / 86_400)}d ago`;
}

export function stamp(epoch: number): string {
	if (!epoch) return 'Unknown date';

	return new SvelteDate(epoch * 1000).toLocaleString(undefined, {
		day: 'numeric',
		month: 'short',
		hour: 'numeric',
		minute: '2-digit'
	});
}

export function precise(epoch: number): string {
	if (!epoch) return 'Unknown date';

	return new SvelteDate(epoch * 1000).toLocaleString(undefined, {
		dateStyle: 'full',
		timeStyle: 'medium'
	});
}

export const teamColors: Record<string, string> = {
	Civilian: '#8b8b8b',
	Police: '#3b82f6',
	Sheriff: '#eab308',
	Fire: '#f03232',
	DOT: '#f97316',
	Jail: '#8b5cf6'
};

export const typeTones: Record<string, string> = {
	Warning: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
	Kick: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
	Ban: 'border-red-400/30 bg-red-400/10 text-red-300',
	BOLO: 'border-violet-400/30 bg-violet-400/10 text-violet-300'
};

export function tone(type: string): string {
	return typeTones[type] ?? 'border-line bg-white/5 text-muted';
}
