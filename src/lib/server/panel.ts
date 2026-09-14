import { error } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getGuilds } from './guilds';
import {
	getLiveServer,
	type LivePlayer,
	type LiveServer,
	type LiveStatus,
	type LiveVehicle
} from './overview';
import { TtlCache } from './cache';
import { noteUnauthorized, requireUser, sessionCookie } from './session';
import { getPermissions, type ResolvedPermissions } from './permissions';
import { documentationIcon } from '../settings';
import { discordFallbackAvatar } from '../panel';

const timeout = 10_000;

export interface PanelAccess {
	token: string;
	discordId: string;
	username: string;
	guildId: string;
	guild: { id: string; name: string; iconUrl: string };
	level: number;
	permissions: ResolvedPermissions;
}

interface PanelEvent {
	cookies: Cookies;
	locals: App.Locals;
	params: Partial<Record<string, string>>;
	url: URL;
}

export async function authorizePanel(event: PanelEvent): Promise<PanelAccess> {
	const user = await requireUser(event.locals, event.url);

	const token = event.cookies.get(sessionCookie) ?? '';
	const guildId = event.params.guildID ?? '';
	if (!/^\d{17,20}$/.test(guildId)) error(404, 'You do not have access to that server.');

	const guilds = await getGuilds(token, guildId);
	if (!guilds) error(502, 'Your servers are unavailable right now, try again shortly.');

	const guild = guilds.find((entry) => entry.id === guildId);
	if (!guild) error(404, 'You do not have access to that server.');
	const permissions = await getPermissions(token, guildId);

	const custom =
		permissions.mode === 'custom' &&
		Object.entries(permissions.granted).some(
			([key, value]) => value && key.startsWith('dashboard.') && key.endsWith('.view')
		);
	if (guild.permissionLevel < 1 && !custom) {
		error(403, 'Only staff can use the moderation panel.');
	}

	return {
		token,
		discordId: user.discordId,
		username: user.username,
		guildId,
		guild: { id: guild.id, name: guild.name, iconUrl: guild.iconUrl },
		level: guild.permissionLevel,
		permissions
	};
}

export interface Reply {
	status: number;
	body: Record<string, unknown>;
}

export async function call(
	token: string,
	path: string,
	init: RequestInit = {},
	ms: number = timeout
): Promise<Reply | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}${path}`, {
			...init,
			headers: {
				Authorization: token,
				...(init.body ? { 'Content-Type': 'application/json' } : {}),
				...init.headers
			},
			signal: AbortSignal.timeout(ms)
		});

		noteUnauthorized(token, response.status);

		const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
		return { status: response.status, body };
	} catch (cause) {
		console.warn(`${path} failed:`, cause);
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

async function read(token: string, path: string, key: string): Promise<Record<string, unknown>[]> {
	const reply = await call(token, path);
	if (!reply || reply.status !== 200) return [];
	return list(reply.body[key]);
}

async function readNames(token: string, path: string, key: string): Promise<string[]> {
	const reply = await call(token, path);
	if (!reply || reply.status !== 200) return [];

	const value = reply.body[key];
	return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : [];
}

async function readChecked(
	token: string,
	path: string,
	key: string
): Promise<{ rows: Record<string, unknown>[]; ok: boolean }> {
	const reply = await call(token, path);
	if (!reply || reply.status !== 200) return { rows: [], ok: false };

	return { rows: list(reply.body[key]), ok: true };
}

export interface Shift {
	id: string;
	userId: string;
	name: string;
	type: string;
	startEpoch: number;
	endEpoch: number;
	onBreak: boolean;
	breaks: number;
	breakEpoch: number;
	moderations: number;
}

function readShift(raw: Record<string, unknown>): Shift {
	const breaks = list(raw.Breaks);
	const open = breaks.find((entry) => num(entry.EndEpoch) === 0);

	return {
		id: text(raw.ID),
		userId: text(raw.UserID),
		name: text(raw.Nickname) || text(raw.Username, 'Unknown'),
		type: text(raw.Type, 'Default'),
		startEpoch: num(raw.StartEpoch) + num(raw.RemovedTime) - num(raw.AddedTime),
		endEpoch: num(raw.EndEpoch),
		onBreak: !!open,
		breaks: breaks.length,
		breakEpoch: open ? num(open.StartEpoch) : 0,
		moderations: Array.isArray(raw.Moderations) ? raw.Moderations.length : 0
	};
}

export interface Moderation {
	id: string;
	snowflake: string;
	username: string;
	userId: string;
	type: string;
	reason: string;
	moderator: string;
	moderatorId: string;
	epoch: number;
	untilEpoch: number;
}

function readModeration(raw: Record<string, unknown>): Moderation {
	return {
		id: text(raw.ID),
		snowflake: text(raw.Snowflake),
		username: text(raw.Username, 'Unknown'),
		userId: text(String(raw.UserID ?? '')),
		type: text(raw.Type, 'Unknown'),
		reason: text(raw.Reason, 'No reason given'),
		moderator: text(raw.Moderator, 'Unknown'),
		moderatorId: text(raw.ModeratorID),
		epoch: num(raw.Epoch),
		untilEpoch: num(raw.UntilEpoch)
	};
}

export interface PriorityComment {
	id: string;
	userId: string;
	username: string;
	avatarUrl: string;
	content: string;
	createdAt: number;
}

function readComment(raw: Record<string, unknown>): PriorityComment {
	return {
		id: text(raw.id),
		userId: text(String(raw.user_id ?? '')),
		username: text(raw.username, 'Unknown'),
		avatarUrl: text(raw.avatar_url, discordFallbackAvatar),
		content: text(raw.content),
		createdAt: num(raw.created_at)
	};
}

export interface Priority {
	id: string;
	userId: string;
	reason: string;
	players: string[];
	status: string;
	createdAt: number;
	message: string;
	minutes: number;
	comments: PriorityComment[];
}

function readPriority(raw: Record<string, unknown>): Priority {
	return {
		id: text(raw.id),
		userId: text(String(raw.user_id ?? '')),
		reason: text(raw.reason, 'No reason given'),
		players: Array.isArray(raw.players) ? raw.players.map((entry) => String(entry)) : [],
		status: text(raw.status, 'pending'),
		createdAt: num(raw.created_at),
		message: text(raw.priority_message),
		minutes: num(raw.priority_time),
		comments: list(raw.comments)
			.map(readComment)
			.filter((comment) => comment.content)
	};
}

export interface StaffRequest {
	id: string;
	userId: string;
	username: string;
	avatar: string;
	reason: string;
	createdAt: number;
	acked: string[];
}

function readRequest(raw: Record<string, unknown>): StaffRequest {
	return {
		id: text(raw.id),
		userId: text(raw.user_id),
		username: text(raw.username, 'Unknown'),
		avatar: text(raw.avatar),
		reason: text(raw.reason, 'No reason given'),
		createdAt: num(raw.created_at),
		acked: Array.isArray(raw.acked) ? raw.acked.map((entry) => String(entry)) : []
	};
}

export interface Owner {
	id: string;
	name: string;
	inGame: boolean;
	lead: boolean;
}

export interface PanelServer {
	status: LiveStatus;
	message: string;
	name: string;
	joinKey: string;
	currentPlayers: number;
	maxPlayers: number;
	queue: number;
	owners: Owner[];
	players: LivePlayer[];
	vehicles: LiveVehicle[];
	fetchedAt: number;
}

export interface Snapshot {
	server: PanelServer;
	logs: LogEntry[];
	logIssues: LogKind[];
	shifts: Shift[];
	myShift: Shift | null;
	myHistory: Shift[];
	moderations: Moderation[];
	priorities: Priority[];
	requests: StaffRequest[];
}

const usernameTtl = 6 * 60 * 60_000;
const usernames = new TtlCache<string>(usernameTtl);

async function getUsername(token: string, id: string): Promise<string> {
	const cached = usernames.get(id);
	if (cached !== undefined) return cached;

	return usernames.dedupe(`username:${id}`, async () => {
		const reply = await call(token, `/Roblox/User/${encodeURIComponent(id)}`);
		const name = reply?.status === 200 ? text(reply.body.Username) : '';

		if (name) usernames.set(id, name);

		return name;
	});
}

async function getOwners(token: string, live: LiveServer): Promise<Owner[]> {
	const ids = [live.ownerId, ...live.coOwnerIds].filter(Boolean);
	if (!ids.length) return [];

	return Promise.all(
		ids.map(async (id, index) => {
			const present = live.players.find((player) => player.id === id);

			return {
				id,
				name: present?.name || (await getUsername(token, id)) || `Roblox ${id}`,
				inGame: !!present,
				lead: index === 0
			};
		})
	);
}

export async function loadServer(token: string, guildId: string): Promise<PanelServer> {
	const live = await getLiveServer(guildId, token);

	return {
		status: live.status,
		message: live.message,
		name: live.name,
		joinKey: live.joinKey,
		currentPlayers: live.currentPlayers,
		maxPlayers: live.maxPlayers,
		queue: live.queue,
		owners: await getOwners(token, live).catch(() => []),
		players: live.players,
		vehicles: live.vehicles,
		fetchedAt: live.fetchedAt
	};
}

export async function loadShifts(token: string, guildId: string): Promise<Shift[]> {
	const rows = await read(token, `/${guildId}/GetActiveShifts`, 'Shifts');
	return rows.map(readShift);
}

export async function loadMyShift(token: string, guildId: string): Promise<Shift | null> {
	const reply = await call(token, `/${guildId}/CheckUserActiveShift`);
	if (!reply || reply.status !== 200 || reply.body.Active !== true) return null;

	const raw = reply.body.Shift;
	return raw && typeof raw === 'object' ? readShift(raw as Record<string, unknown>) : null;
}

export async function loadMyHistory(
	token: string,
	guildId: string,
	discordId: string
): Promise<Shift[]> {
	const rows = await read(token, `/${guildId}/${discordId}/GetUserShifts`, 'Shifts');

	return rows
		.map(readShift)
		.filter((shift) => shift.endEpoch > 0)
		.sort((a, b) => b.endEpoch - a.endEpoch)
		.slice(0, 60);
}

export async function loadModerations(token: string, guildId: string): Promise<Moderation[]> {
	const rows = await read(token, `/${guildId}/GetModerations?Limit=60`, 'Moderations');
	return rows.map(readModeration);
}

export async function loadPriorities(token: string, guildId: string): Promise<Priority[]> {
	const rows = await read(token, `/${guildId}/GetActivePriorities`, 'priorities');
	return rows.map(readPriority);
}

export async function loadRequests(token: string, guildId: string): Promise<StaffRequest[]> {
	const reply = await call(token, `/${guildId}/GetActiveStaffRequests`);
	if (!reply || reply.status !== 200) return [];

	const data = (reply.body.data ?? {}) as Record<string, unknown>;
	return list(data.requests).map(readRequest);
}

export interface DiscordMatch {
	name: string;
	id: string;
	team: string;
	staff: boolean;
	avatarUrl: string;
	discordId: string;
	discordName: string;
	discordAvatarUrl: string;
	nickname: string;
}

export interface DiscordCheck {
	status: number;
	players: DiscordMatch[];
}

export async function loadDiscordCheck(token: string, guildId: string): Promise<DiscordCheck> {
	const live = await getLiveServer(guildId, token);
	const players = live.players.filter((player) => player.name);
	if (!players.length) return { status: 200, players: [] };

	const reply = await call(token, `/${guildId}/CompareMembers`, {
		method: 'POST',
		body: JSON.stringify(players.map((player) => player.name))
	});

	if (!reply || reply.status !== 200) return { status: reply?.status ?? 502, players: [] };

	const members = list(reply.body.Members).map((member) => ({
		nickname: text(member.Nick),
		discordId: text(member.Snowflake) || text(member.ID),
		discordName: text(member.Name)
	}));

	const matched = players.map((player) => ({
		player,
		member: members.find((entry) =>
			entry.nickname.toLowerCase().includes(player.name.toLowerCase())
		)
	}));

	const [avatars, profiles] = await Promise.all([
		getRobloxAvatars(
			token,
			players.map((player) => player.id)
		),
		getDiscordProfiles(token, matched.map((row) => row.member?.discordId ?? '').filter(Boolean))
	]);

	return {
		status: 200,
		players: matched.map(({ player, member }) => ({
			name: player.name,
			id: player.id,
			team: player.team,
			staff: player.permission !== 'Normal',
			avatarUrl: avatars.get(player.id) ?? '',
			discordId: member?.discordId ?? '',
			discordName: member?.discordName ?? '',
			discordAvatarUrl: (member?.discordId && profiles.get(member.discordId)?.avatarUrl) || '',
			nickname: member?.nickname ?? ''
		}))
	};
}

export async function loadVehicleRestrictions(token: string, guildId: string): Promise<string[]> {
	const reply = await call(token, `/${guildId}/GetVehicleRestrictions`);
	if (!reply || reply.status !== 200) return [];

	const restrictions = (reply.body.RestrictedCars ?? {}) as Record<string, unknown>;

	return Array.isArray(restrictions.Cars)
		? restrictions.Cars.map((entry) => String(entry)).filter(Boolean)
		: [];
}

export async function getSnapshot(
	token: string,
	guildId: string,
	discordId: string
): Promise<Snapshot> {
	if (!logCache.stale(guildId)?.length) await refreshLogs(token, guildId).catch(() => null);

	const [server, shifts, myShift, myHistory, moderations, priorities, requests] = await Promise.all(
		[
			loadServer(token, guildId),
			loadShifts(token, guildId),
			loadMyShift(token, guildId),
			loadMyHistory(token, guildId, discordId),
			loadModerations(token, guildId),
			loadPriorities(token, guildId),
			loadRequests(token, guildId)
		]
	);

	return {
		server,
		logs: cachedLogs(guildId),
		logIssues: cachedIssues(guildId),
		shifts,
		myShift,
		myHistory,
		moderations,
		priorities,
		requests
	};
}

export interface ModerationQuery {
	skip: number;
	limit: number;
	type: string;
	username: string;
	userId: string;
	reason: string;
	from: number;
	to: number;
}

export interface ModerationPage {
	rows: Moderation[];
	total: number;
}

const discordEpoch = 1_420_070_400_000;

function snowflake(epoch: number): string {
	return String(BigInt(Math.max(0, epoch * 1000 - discordEpoch)) << 22n);
}

export async function getModerationPage(
	token: string,
	guildId: string,
	query: ModerationQuery
): Promise<ModerationPage> {
	const params = new URLSearchParams({
		Limit: String(query.limit),
		Skip: String(query.skip),
		WithTotal: '1'
	});

	if (query.type) params.set('TypeFilter', query.type);
	if (query.username) params.set('Username', query.username);
	if (query.userId) params.set('UserID', query.userId);
	if (query.reason) params.set('ReasonContains', query.reason);
	if (query.to) params.set('BeforeSnowflake', snowflake(query.to));

	const reply = await call(token, `/${guildId}/GetModerations?${params}`);
	if (!reply || reply.status !== 200) return { rows: [], total: 0 };

	const rows = list(reply.body.Moderations).map(readModeration);
	const total = num(reply.body.Total);
	if (!query.from) return { rows, total };

	const kept = rows.filter((entry) => entry.epoch >= query.from);

	return { rows: kept, total: kept.length < rows.length ? query.skip + kept.length : total };
}

export interface ModerationDetail {
	avatarUrl: string;
	moderatorAvatarUrl: string;
	moderatorName: string;
}

const avatarTtl = 30 * 60_000;
const unknownUser = 'unknown';

const robloxAvatars = new TtlCache<string>(avatarTtl);
const discordProfiles = new TtlCache<{ avatarUrl: string; username: string }>(avatarTtl);

async function getRobloxAvatar(token: string, userId: string): Promise<string> {
	if (!userId) return '';

	const cached = robloxAvatars.get(userId);
	if (cached !== undefined) return cached;

	return robloxAvatars.dedupe(`roblox:${userId}`, async () => {
		const reply = await call(token, '/Roblox/Thumbnails', {
			method: 'POST',
			body: JSON.stringify([Number(userId)])
		});

		const url = reply?.status === 200 ? text(reply.body[userId]) : '';
		if (url) robloxAvatars.set(userId, url);

		return url;
	});
}

export async function getDiscordProfile(
	token: string,
	discordId: string
): Promise<{ avatarUrl: string; username: string }> {
	const empty = { avatarUrl: discordFallbackAvatar, username: '' };
	if (!discordId) return empty;

	const cached = discordProfiles.get(discordId);
	if (cached !== undefined) return cached;

	return discordProfiles.dedupe(`discord:${discordId}`, async () => {
		const reply = await call(token, '/Discord/UserAvatarsWithUsername', {
			method: 'POST',
			body: JSON.stringify([discordId])
		});

		const profile = (list(reply?.body.Avatars)[0] ?? {}) as Record<string, unknown>;
		const value = {
			avatarUrl: text(profile.avatar_url, discordFallbackAvatar),
			username: text(profile.username)
		};

		if (value.username && value.username !== unknownUser) {
			discordProfiles.set(discordId, value);
		}

		return value;
	});
}

export async function getDiscordProfiles(
	token: string,
	ids: string[]
): Promise<Map<string, { avatarUrl: string; username: string }>> {
	const found = new Map<string, { avatarUrl: string; username: string }>();
	const missing: string[] = [];

	for (const id of ids) {
		const cached = discordProfiles.get(id);

		if (cached === undefined) missing.push(id);
		else found.set(id, cached);
	}

	if (!missing.length || Date.now() < profilesDownUntil) return found;

	const chunks: string[][] = [];
	for (let index = 0; index < missing.length; index += thumbnailChunk) {
		chunks.push(missing.slice(index, index + thumbnailChunk));
	}

	const replies = await Promise.all(
		chunks.map((chunk) =>
			call(
				token,
				'/Discord/UserAvatarsWithUsername',
				{ method: 'POST', body: JSON.stringify(chunk) },
				profileTimeout
			)
		)
	);

	if (replies.every((reply) => reply?.status !== 200))
		profilesDownUntil = Date.now() + profileCooldown;

	for (const reply of replies) {
		if (reply?.status !== 200) continue;

		for (const raw of list(reply.body.Avatars)) {
			const id = text(raw.id);
			const username = text(raw.username);
			if (!id || !username || username === unknownUser) continue;

			const value = { avatarUrl: text(raw.avatar_url, discordFallbackAvatar), username };

			discordProfiles.set(id, value);
			found.set(id, value);
		}
	}

	return found;
}

const thumbnailChunk = 100;

const profileTimeout = 4_000;

const profileCooldown = 30_000;
let profilesDownUntil = 0;

async function getRobloxAvatars(token: string, ids: string[]): Promise<Map<string, string>> {
	const found = new Map<string, string>();
	const missing: string[] = [];

	for (const id of ids) {
		const cached = robloxAvatars.get(id);

		if (cached === undefined) missing.push(id);
		else found.set(id, cached);
	}

	for (let index = 0; index < missing.length; index += thumbnailChunk) {
		const chunk = missing.slice(index, index + thumbnailChunk);
		const reply = await call(token, '/Roblox/Thumbnails', {
			method: 'POST',
			body: JSON.stringify(chunk.map(Number))
		});

		if (reply?.status !== 200) continue;

		for (const id of chunk) {
			const url = text(reply.body[id]);
			if (!url) continue;

			robloxAvatars.set(id, url);
			found.set(id, url);
		}
	}

	return found;
}

export interface BannedPlayer {
	id: string;
	name: string;
	avatarUrl: string;
	reason: string;
	moderator: string;
	epoch: number;
}

export interface BanList {
	players: BannedPlayer[];
	wait: number;
}

const banHistoryLimit = 200;
export const massUnbanCommand = 'massUnban';
const massUnbanCooldown = 86_400;

export async function massUnbanWait(token: string, guildId: string): Promise<number> {
	const rows = await read(
		token,
		`/${guildId}/GetPanelCommands?limit=1&command=${massUnbanCommand}`,
		'commands'
	);

	const last = num(rows[0]?.epoch);
	if (!last) return 0;

	return Math.max(0, massUnbanCooldown - (Math.floor(Date.now() / 1000) - last));
}

export async function loadBans(token: string, guildId: string): Promise<BanList> {
	const [rows, history, wait] = await Promise.all([
		read(token, `/${guildId}/GetERLCBans`, 'Bans'),
		getModerationPage(token, guildId, {
			skip: 0,
			limit: banHistoryLimit,
			type: 'Ban',
			username: '',
			userId: '',
			reason: '',
			from: 0,
			to: 0
		}).catch(() => ({ rows: [], total: 0 }) as ModerationPage),
		massUnbanWait(token, guildId).catch(() => 0)
	]);

	const latest = new Map<string, Moderation>();
	for (const entry of history.rows.toSorted((a, b) => b.epoch - a.epoch)) {
		if (entry.userId && !latest.has(entry.userId)) latest.set(entry.userId, entry);
	}

	const banned = rows
		.map((raw) => ({ id: text(raw.PlayerId), name: text(raw.PlayerName) }))
		.filter((entry) => entry.id);

	const avatars = await getRobloxAvatars(
		token,
		banned.map((entry) => entry.id)
	).catch(() => new Map<string, string>());

	const players = banned
		.map((entry) => {
			const record = latest.get(entry.id);

			return {
				id: entry.id,
				name: entry.name || `Roblox ${entry.id}`,
				avatarUrl: avatars.get(entry.id) ?? '',
				reason: record?.reason ?? '',
				moderator: record?.moderator ?? '',
				epoch: record?.epoch ?? 0
			};
		})
		.toSorted((a, b) => b.epoch - a.epoch || a.name.localeCompare(b.name));

	return { players, wait };
}

export async function getModerationDetail(
	token: string,
	userId: string,
	moderatorId: string
): Promise<ModerationDetail> {
	const [avatarUrl, profile] = await Promise.all([
		getRobloxAvatar(token, userId),
		getDiscordProfile(token, moderatorId)
	]);

	return {
		avatarUrl,
		moderatorAvatarUrl: profile.avatarUrl,
		moderatorName: profile.username
	};
}

export interface Documentation {
	id: string;
	name: string;
	url: string;
	icon: string;
	level: number;
}

export interface Preset {
	name: string;
	result: string;
	type: string;
	permissionLevel: number;
}

export interface PanelOptions {
	shiftTypes: string[];
	punishmentTypes: string[];
	presets: Preset[];
	documentation: Documentation[];
}

const fallbackPunishments = ['Warning', 'Kick', 'Ban', 'BOLO'];

export async function getOptions(
	token: string,
	guildId: string,
	level: number
): Promise<PanelOptions> {
	const [shiftTypes, punishmentTypes, presets, documentation] = await Promise.all([
		readNames(token, `/${guildId}/GetServerShiftTypes`, 'ShiftTypes'),
		call(token, `/${guildId}/GetServerPunishmentTypes`),
		read(token, `/${guildId}/GetServerPunishmentPresets`, 'presets'),
		read(token, `/${guildId}/GetDocumentationTypes`, 'documentation_types')
	]);

	const types = punishmentTypes?.status === 200 ? punishmentTypes.body.PunishmentTypes : null;
	const names = Array.isArray(types) ? types.map((entry) => String(entry)).filter(Boolean) : [];

	return {
		shiftTypes,
		punishmentTypes: names.length ? names : fallbackPunishments,
		presets: presets.map((entry) => ({
			name: text(entry.name),
			result: text(entry.result),
			type: text(entry.type),
			permissionLevel: num(entry.permissionLevel)
		})),
		documentation: documentation
			.map((entry) => ({
				id: text(entry.id),
				name: text(entry.name, 'Untitled'),
				url: text(entry.url),
				icon: documentationIcon({
					id: text(entry.id),
					name: text(entry.name, 'Untitled'),
					url: text(entry.url),
					punishmentLevel: num(entry.punishmentLevel),
					faviconURL: text(entry.faviconURL)
				}),
				level: num(entry.punishmentLevel)
			}))
			.filter((entry) => entry.url.startsWith('https://') && entry.level <= level)
	};
}

export type LogKind = 'kills' | 'commands' | 'calls' | 'joins';

export interface LogEntry {
	id: string;
	kind: LogKind;
	timestamp: number;
	actor: string;
	actorId: string;
	subject: string;
	subjectId: string;
	detail: string;
	remoteBy?: string;
}

interface RemoteCommand {
	command: string;
	target: string;
	by: string;
	at: number;
}

const remoteTtl = 60_000;
const remoteLimit = 300;
const remoteWindow = 25;

const remoteCache = new TtlCache<RemoteCommand[]>(remoteTtl);

export type RemoteActor = Pick<PanelAccess, 'token' | 'guildId' | 'username'>;

export async function recordRemote(
	access: RemoteActor,
	command: string,
	target: string
): Promise<void> {
	const entry = { command, target, by: access.username, at: Math.floor(Date.now() / 1000) };
	const rows = remoteCache.stale(access.guildId) ?? [];
	remoteCache.set(access.guildId, [entry, ...rows].slice(0, remoteLimit));

	await call(access.token, `/${access.guildId}/LogPanelCommand`, {
		method: 'POST',
		body: JSON.stringify({ command, target, by: access.username })
	});
}

const unbanBatch = 50;
const unbanGap = 1_500;
const embedded = /\{[\s\S]*}/;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readable(message: string): string {
	const match = message.match(embedded);
	if (!match) return message.includes('non-200 status code') ? '' : message;

	try {
		const body = JSON.parse(match[0]) as { message?: unknown };
		return typeof body.message === 'string' ? body.message.trim() : '';
	} catch {
		return '';
	}
}

export function waitLabel(seconds: number): string {
	const hours = Math.ceil(seconds / 3_600);
	if (hours > 1) return `${hours} hours`;

	const minutes = Math.max(1, Math.ceil(seconds / 60));
	return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export interface MassUnbanOutcome {
	ok: boolean;
	done: number;
	message: string;
}

export async function runMassUnban(access: RemoteActor, ids: string[]): Promise<MassUnbanOutcome> {
	if (!ids.length) return { ok: false, done: 0, message: 'Pick at least one banned player.' };

	const wait = await massUnbanWait(access.token, access.guildId);
	if (wait) {
		return {
			ok: false,
			done: 0,
			message: `Mass unban is on cooldown, try again in ${waitLabel(wait)}.`
		};
	}

	let done = 0;

	for (let index = 0; index < ids.length; index += unbanBatch) {
		const chunk = ids.slice(index, index + unbanBatch);
		const reply = await call(
			access.token,
			`/${access.guildId}/UnbanERLCPlayer/${chunk.join(',')}`,
			{ method: 'POST' }
		);

		if (!reply || reply.status !== 200) {
			if (done) await recordRemote(access, massUnbanCommand, `${done} players`).catch(() => null);

			const failure = reply
				? readable(text(reply.body.message) || text(reply.body.Message)) || 'That action failed.'
				: 'The bot is not responding right now, try again shortly.';

			return {
				ok: false,
				done,
				message: done ? `Unbanned ${done} of ${ids.length} before stopping. ${failure}` : failure
			};
		}

		done += chunk.length;

		if (index + unbanBatch < ids.length) await pause(unbanGap);
	}

	await recordRemote(access, massUnbanCommand, `${done} players`).catch(() => null);

	return { ok: true, done, message: `Unbanned ${done} player${done === 1 ? '' : 's'}.` };
}

export async function refreshRemote(token: string, guildId: string): Promise<void> {
	const rows = await read(token, `/${guildId}/GetPanelCommands?limit=${remoteLimit}`, 'commands');

	remoteCache.set(
		guildId,
		rows
			.map((raw) => ({
				command: text(raw.command),
				target: text(raw.target),
				by: text(raw.by),
				at: num(raw.epoch)
			}))
			.filter((entry) => entry.command)
	);
}

function attribute(guildId: string, entry: LogEntry): LogEntry {
	if (entry.kind !== 'commands') return entry;

	const rows = remoteCache.stale(guildId);
	if (!rows?.length) return entry;

	const detail = entry.detail.toLowerCase();
	const match = rows.find(
		(row) =>
			Math.abs(row.at - entry.timestamp) <= remoteWindow &&
			detail.startsWith(`:${row.command.toLowerCase()}`) &&
			(!row.target || detail.includes(row.target.toLowerCase()))
	);

	return match ? { ...entry, remoteBy: match.by } : entry;
}

const logTtl = 60_000;
const logLimit = 400;

const logSources: Record<LogKind, { path: string; key: string }> = {
	kills: { path: 'GetERLCKillLogs', key: 'KillLogs' },
	commands: { path: 'GetERLCCommandLogs', key: 'CommandLogs' },
	calls: { path: 'GetERLCModLogs', key: 'ModLogs' },
	joins: { path: 'GetERLCJoinLogs', key: 'JoinLogs' }
};

function split(value: unknown): { name: string; id: string } {
	const [name, id] = text(value).split(':');
	return { name: name ?? '', id: id ?? '' };
}

async function getLogKind(
	token: string,
	guildId: string,
	kind: LogKind
): Promise<{ entries: LogEntry[]; ok: boolean }> {
	const source = logSources[kind];
	const { rows, ok } = await readChecked(token, `/${guildId}/${source.path}`, source.key);

	const entries = rows
		.map((raw) => {
			const timestamp = num(raw.Timestamp);

			if (kind === 'kills') {
				const killer = split(raw.Killer);
				const killed = split(raw.Killed);
				return {
					id: `${kind}-${timestamp}-${killer.id}-${killed.id}`,
					kind,
					timestamp,
					actor: killer.name,
					actorId: killer.id,
					subject: killed.name,
					subjectId: killed.id,
					detail: 'killed'
				};
			}

			if (kind === 'calls') {
				const caller = split(raw.Caller);
				const moderator = split(raw.Moderator);
				return {
					id: `${kind}-${timestamp}-${caller.id}`,
					kind,
					timestamp,
					actor: caller.name,
					actorId: caller.id,
					subject: moderator.name,
					subjectId: moderator.id,
					detail: 'called a mod'
				};
			}

			const player = split(raw.Player);
			const detail = kind === 'joins' ? (raw.Join === true ? 'joined' : 'left') : text(raw.Command);

			return {
				id: `${kind}-${timestamp}-${player.id}-${detail}`,
				kind,
				timestamp,
				actor: player.name,
				actorId: player.id,
				subject: '',
				subjectId: '',
				detail
			};
		})
		.sort((a, b) => b.timestamp - a.timestamp);

	return { entries, ok };
}

const logCache = new TtlCache<LogEntry[]>(logTtl);
const issueCache = new TtlCache<LogKind[]>(logTtl);

export function cachedIssues(guildId: string): LogKind[] {
	return issueCache.get(guildId) ?? issueCache.stale(guildId) ?? [];
}

const logKinds = Object.keys(logSources) as LogKind[];

export function cachedLogs(guildId: string): LogEntry[] {
	const rows = logCache.get(guildId) ?? logCache.stale(guildId) ?? [];
	return rows.map((entry) => attribute(guildId, entry));
}

function merge(previous: LogEntry[], incoming: LogEntry[]): LogEntry[] {
	const byId = new Map(previous.map((entry) => [entry.id, entry]));
	for (const entry of incoming) byId.set(entry.id, entry);

	return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, logLimit);
}

export async function refreshLogs(token: string, guildId: string): Promise<LogEntry[]> {
	return logCache.dedupe(`logs:${guildId}`, async () => {
		await refreshRemote(token, guildId).catch(() => null);

		const kept = logCache.stale(guildId) ?? [];
		const fresh: LogEntry[] = [];
		const failed: LogKind[] = [];

		for (const kind of logKinds) {
			const result = await getLogKind(token, guildId, kind);

			if (!result.ok) failed.push(kind);
			if (result.entries.length) fresh.push(...result.entries);
		}

		const merged = fresh.length ? merge(kept, fresh) : kept;
		logCache.set(guildId, merged);
		issueCache.set(guildId, failed);

		return merged;
	});
}

export interface RobloxUser {
	id: string;
	username: string;
	displayName: string;
}

export interface RobloxProfile {
	id: string;
	username: string;
	displayName: string;
	avatarUrl: string;
	created: string;
	description: string;
	banned: boolean;
	friends: number;
	followers: number;
	following: number;
}

export async function getProfile(token: string, id: string): Promise<RobloxProfile | null> {
	const reply = await call(token, `/Roblox/UserComprehensive/${encodeURIComponent(id)}`);
	if (!reply || reply.status !== 200) return null;

	const user = (reply.body.userData ?? {}) as Record<string, unknown>;
	if (!user.id) return null;

	const friends = (reply.body.friends ?? {}) as Record<string, unknown>;

	return {
		id: String(user.id),
		username: text(user.username, 'Unknown'),
		displayName: text(user.displayName) || text(user.username, 'Unknown'),
		avatarUrl: text(reply.body.thumbnailURL),
		created: text(user.joinDate),
		description: text(user.description),
		banned: user.isBanned === true,
		friends: num(friends.count),
		followers: num(friends.followers),
		following: num(friends.following)
	};
}

export async function searchRoblox(token: string, query: string): Promise<RobloxUser[]> {
	const reply = await call(token, `/Roblox/UserSearch?query=${encodeURIComponent(query)}`);
	if (!reply || reply.status !== 200) return [];

	return list(reply.body.Users)
		.map((entry) => ({
			id: String(entry.RobloxID ?? ''),
			username: text(entry.Username),
			displayName: text(entry.DisplayName)
		}))
		.filter((user) => user.id && user.username)
		.slice(0, 8);
}
