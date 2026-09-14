import { env } from '$env/dynamic/private';
import {
	defaultAccent,
	linkLabelLimit,
	linkLimit,
	taglineLimit,
	validAccent,
	validUrl,
	type OverviewLink,
	type OverviewSettings
} from '$lib/serverOverview';
import { teamNames } from '$lib/settings';
import { cdn } from './guilds';
import { TtlCache } from './cache';

export type LiveStatus = 'ok' | 'offline' | 'unconfigured' | 'unavailable';

export interface LivePlayer {
	name: string;
	id: string;
	team: string;
	permission: string;
}

export interface LiveJoin {
	name: string;
	id: string;
	join: boolean;
	timestamp: number;
}

export interface LiveVehicle {
	name: string;
	texture: string;
	owner: string;
}

export interface LiveServer {
	status: LiveStatus;
	message: string;
	name: string;
	joinKey: string;
	currentPlayers: number;
	maxPlayers: number;
	queue: number;
	ownerId: string;
	coOwnerIds: string[];
	players: LivePlayer[];
	joinLogs: LiveJoin[];
	vehicles: LiveVehicle[];
	fetchedAt: number;
}

export interface OverviewGuild {
	id: string;
	name: string;
	description: string;
	iconUrl: string;
	bannerUrl: string;
}

const liveTtl = 30_000;
const guildTtl = 5 * 60_000;
const settingsTtl = 60_000;
const timeout = 10_000;

const live = new TtlCache<LiveServer>(liveTtl);
const guilds = new TtlCache<OverviewGuild>(guildTtl);
const configs = new TtlCache<OverviewSettings>(settingsTtl);

interface Reply {
	status: number;
	body: Record<string, unknown>;
}

async function call(guildId: string, path: string, token = ''): Promise<Reply | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}/${guildId}${path}`, {
			headers: { Authorization: token },
			signal: AbortSignal.timeout(timeout)
		});

		const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
		return { status: response.status, body };
	} catch (error) {
		console.warn(`${path} failed:`, error);
		return null;
	}
}

function text(value: unknown, fallback = ''): string {
	return typeof value === 'string' && value ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function readLinks(value: unknown): OverviewLink[] {
	return list(value)
		.map((entry) => ({
			label: text(entry.label).trim().slice(0, linkLabelLimit),
			url: text(entry.url).trim()
		}))
		.filter((entry) => entry.label && validUrl(entry.url))
		.slice(0, linkLimit);
}

export function readOverview(raw: Record<string, unknown> | null | undefined): OverviewSettings {
	const value = raw ?? {};
	const panels = (value.panels ?? {}) as Record<string, unknown>;
	const accent = text(value.accent);
	const banner = text(value.banner).trim();

	return {
		enabled: value.enabled !== false,
		tagline: text(value.tagline).slice(0, taglineLimit),
		accent: validAccent(accent) ? accent.toLowerCase() : defaultAccent,
		banner: validUrl(banner) ? banner : '',
		join_button: value.join_button !== false,
		links: readLinks(value.links),
		panels: {
			players: panels.players !== false,
			teams: panels.teams !== false,
			activity: panels.activity !== false,
			vehicles: panels.vehicles !== false,
			moderations: panels.moderations !== false,
			priorities: panels.priorities === true
		}
	};
}

export async function getOverviewSettings(guildId: string): Promise<OverviewSettings> {
	const cached = configs.get(guildId);
	if (cached) return cached;

	return configs.dedupe(`overview:${guildId}`, async () => {
		const reply = await call(guildId, '/GetServerOverview');
		if (!reply || reply.status !== 200) {
			return configs.stale(guildId) ?? readOverview({ enabled: false });
		}

		const value = readOverview(reply.body);
		configs.set(guildId, value);
		return value;
	});
}

export function dropOverviewSettings(guildId: string) {
	configs.delete(guildId);
}

export async function getOverviewGuild(guildId: string): Promise<OverviewGuild | null> {
	const cached = guilds.get(guildId);
	if (cached) return cached;

	return guilds.dedupe(`guild:${guildId}`, async () => {
		const reply = await call(guildId, '/GetGuildInformation');
		if (!reply || reply.status !== 200) return guilds.stale(guildId) ?? null;

		const id = text(reply.body.ID, guildId);
		const icon = text(reply.body.Icon);
		const banner = text(reply.body.Banner);

		const value: OverviewGuild = {
			id,
			name: text(reply.body.Name, 'Unknown Server'),
			description: text(reply.body.Description),
			iconUrl: icon ? cdn('icons', id, icon, 256) : '',
			bannerUrl: banner ? cdn('banners', id, banner, 1024) : ''
		};

		guilds.set(guildId, value);
		return value;
	});
}

function empty(status: LiveStatus, message: string): LiveServer {
	return {
		status,
		message,
		name: '',
		joinKey: '',
		currentPlayers: 0,
		maxPlayers: 0,
		queue: 0,
		ownerId: '',
		coOwnerIds: [],
		players: [],
		joinLogs: [],
		vehicles: [],
		fetchedAt: Date.now()
	};
}

function failure(reply: Reply | null): LiveServer {
	if (!reply) return empty('unavailable', 'Live data could not be reached, try again shortly.');

	const message = text(reply.body.message);

	if (reply.status === 422 || /offline or not found/i.test(message)) {
		return empty('offline', 'The server is offline right now.');
	}
	if (reply.status === 429) {
		return empty('unavailable', 'Live data is rate limited, it will refresh shortly.');
	}
	if (/server key/i.test(message)) {
		return empty('unconfigured', 'This server has not connected an ER:LC server yet.');
	}

	return empty('unavailable', message || 'Live data is unavailable right now.');
}

export async function getLiveServer(guildId: string, token = ''): Promise<LiveServer> {
	const key = token ? `staff:${guildId}` : guildId;
	const cached = live.get(key);
	if (cached) return cached;

	return live.dedupe(`live:${key}`, async () => {
		const reply = await call(guildId, '/GetGroupedERLCData', token);
		if (!reply || reply.status !== 200) {
			const result = failure(reply);
			if (result.status !== 'unavailable') live.set(key, result);
			return result;
		}

		const value: LiveServer = {
			status: 'ok',
			message: '',
			name: text(reply.body.Name, 'Unnamed server'),
			joinKey: text(reply.body.JoinKey),
			currentPlayers: num(reply.body.CurrentPlayers),
			maxPlayers: num(reply.body.MaxPlayers),
			queue: num(reply.body.QueueCount),
			ownerId: text(reply.body.OwnerId).replace(/^0$/, ''),
			coOwnerIds: Array.isArray(reply.body.CoOwnerIds)
				? reply.body.CoOwnerIds.map((entry) => String(entry)).filter(
						(entry) => entry && entry !== '0'
					)
				: [],
			players: list(reply.body.Players).map((player) => ({
				name: text(player.Name),
				id: text(player.ID),
				team: text(player.Team, 'Civilian'),
				permission: text(player.Permission, 'Normal')
			})),
			joinLogs: list(reply.body.JoinLogs)
				.map((entry) => ({
					name: text(entry.Name),
					id: text(entry.ID),
					join: entry.Join === true,
					timestamp: num(entry.Timestamp)
				}))
				.sort((a, b) => b.timestamp - a.timestamp),
			vehicles: list(reply.body.Vehicles).map((vehicle) => ({
				name: text(vehicle.Name),
				texture: text(vehicle.Texture),
				owner: text(vehicle.Owner)
			})),
			fetchedAt: Date.now()
		};

		live.set(key, value);
		return value;
	});
}

export interface OverviewLive {
	status: LiveStatus;
	message: string;
	name: string;
	joinKey: string;
	currentPlayers: number;
	maxPlayers: number;
	queue: number;
	staff: number;
	vehicleCount: number;
	teams: { name: string; count: number }[];
	players: LivePlayer[];
	joinLogs: LiveJoin[];
	vehicles: LiveVehicle[];
	fetchedAt: number;
}

export async function overviewLive(
	guildId: string,
	settings: OverviewSettings
): Promise<OverviewLive> {
	const server = await getLiveServer(guildId);
	const known = new Set<string>(teamNames);

	const counts = new Map<string, number>(teamNames.map((name) => [name, 0]));
	for (const player of server.players) {
		const team = known.has(player.team) ? player.team : 'Civilian';
		counts.set(team, (counts.get(team) ?? 0) + 1);
	}

	return {
		status: server.status,
		message: server.message,
		name: server.name,
		joinKey: settings.join_button ? server.joinKey : '',
		currentPlayers: server.currentPlayers,
		maxPlayers: server.maxPlayers,
		queue: server.queue,
		staff: server.players.filter((player) => player.permission !== 'Normal').length,
		vehicleCount: server.vehicles.length,
		teams: settings.panels.teams
			? [...counts].map(([name, count]) => ({ name, count })).filter((team) => team.count)
			: [],
		players: settings.panels.players ? server.players : [],
		joinLogs: settings.panels.activity ? server.joinLogs.slice(0, 5) : [],
		vehicles: settings.panels.vehicles ? server.vehicles : [],
		fetchedAt: server.fetchedAt
	};
}

export interface Moderation {
	id: string;
	type: string;
	reason: string;
	moderator: string;
	epoch: number;
	untilEpoch: number;
}

export interface MyRecord {
	linked: boolean;
	moderations: Moderation[];
}

export async function getMyModerations(token: string, guildId: string): Promise<MyRecord | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}/${guildId}/GetMyModerations`, {
			headers: { Authorization: token },
			signal: AbortSignal.timeout(timeout)
		});
		if (!response.ok) return null;

		const body = (await response.json()) as Record<string, unknown>;

		return {
			linked: body.Linked === true,
			moderations: list(body.Moderations).map((entry) => ({
				id: text(entry.ID),
				type: text(entry.Type, 'Unknown'),
				reason: text(entry.Reason, 'No reason given'),
				moderator: text(entry.Moderator, 'Unknown'),
				epoch: num(entry.Epoch),
				untilEpoch: num(entry.UntilEpoch)
			}))
		};
	} catch (error) {
		console.warn('/GetMyModerations failed:', error);
		return null;
	}
}
