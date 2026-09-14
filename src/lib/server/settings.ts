import { env } from '$env/dynamic/private';
import {
	blankMessage,
	ComponentType,
	isEmptyMessage,
	packMessage,
	readMessage,
	type DiscordMessage
} from '$lib/discord';
import {
	sessionLimits,
	viewVotesButtonId,
	voteButtonId,
	type SessionSettings
} from '$lib/sessions';
import {
	prefixes,
	type BasicSettings,
	type DocumentationType,
	type InfractionNotification,
	type InfractionRoleChange,
	type InfractionSettings,
	type PriorityRequestType,
	type PrioritySettings,
	type PunishmentType
} from '$lib/settings';
import {
	maxAccountAge,
	nicknameLimit,
	packVerificationMessage,
	type VerificationSettings
} from '$lib/verification';
import { revokeSession } from './session';
import { TtlCache } from './cache';

interface Reply {
	ok: boolean;
	status: number;
	body: Record<string, unknown>;
}

const ttl = 60_000;
const documentationTtl = 5 * 60_000;
const timeout = 10_000;

const settings = new TtlCache<Record<string, unknown>>(ttl);
const documentation = new TtlCache<DocumentationType[]>(documentationTtl);
const priorities = new TtlCache<PrioritySettings>(ttl);
const punishmentTypes = new TtlCache<PunishmentType[]>(ttl);
const links = new TtlCache<{ linked: boolean }>(ttl);
const servers = new TtlCache<ServerInformation>(ttl);

async function call(
	token: string,
	guildId: string,
	path: string,
	method = 'GET',
	payload?: unknown
): Promise<Reply | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}/${guildId}${path}`, {
			method,
			headers: {
				Authorization: token,
				...(payload === undefined ? {} : { 'content-type': 'application/json' })
			},
			body: payload === undefined ? undefined : JSON.stringify(payload),
			signal: AbortSignal.timeout(timeout)
		});

		const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
		if (!response.ok) {
			console.warn(`${path} responded ${response.status}: ${JSON.stringify(body)}`);
			if (response.status === 401) revokeSession(token);
		}

		return { ok: response.ok, status: response.status, body };
	} catch (error) {
		console.warn(`${path} failed:`, error);
		return null;
	}
}

function reason(reply: Reply | null, fallback: string): string {
	const message = reply?.body.message;
	return typeof message === 'string' && message ? message : fallback;
}

export function group(raw: Record<string, unknown>, key: string): Record<string, unknown> {
	const value = raw[key];
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function bool(value: unknown): boolean {
	return value === true;
}

export function text(value: unknown, fallback = ''): string {
	return typeof value === 'string' && value ? value : fallback;
}

export function num(value: unknown, fallback = 0): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

export function id(value: unknown): string {
	const single = String(value ?? '');
	return /^\d{17,20}$/.test(single) ? single : '';
}

export function ids(value: unknown): string[] {
	const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
	return list.map((entry) => String(entry)).filter((entry) => /^\d{17,20}$/.test(entry));
}

export function payload(form: FormData): Record<string, unknown> | null {
	try {
		const parsed: unknown = JSON.parse(String(form.get('payload') ?? ''));
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

export function dropGuildSettings(guildId: string) {
	settings.delete(guildId);
	documentation.delete(guildId);
	priorities.delete(guildId);
	punishmentTypes.delete(guildId);
	links.delete(guildId);
	servers.delete(guildId);
}

export function basicSettings(raw: Record<string, unknown>): BasicSettings {
	const customisation = (raw.customisation ?? {}) as Record<string, unknown>;
	const staff = (raw.staff_management ?? {}) as Record<string, unknown>;
	const prefix = String(customisation.prefix ?? '');

	return {
		logChannel: id(raw.erm_log_channel),
		prefix: prefixes.includes(prefix) ? prefix : '>',
		staffRoles: ids(staff.role),
		managementRoles: ids(staff.management_role),
		adminRoles: ids(staff.admin_role)
	};
}

export async function getSettings(
	token: string,
	guildId: string
): Promise<Record<string, unknown> | null> {
	const cached = settings.get(guildId);
	if (cached) return cached;

	return settings.dedupe(`settings:${guildId}`, async () => {
		const reply = await call(token, guildId, '/GetServerSettings');
		if (!reply?.ok) return settings.stale(guildId) ?? null;

		settings.set(guildId, reply.body);
		return reply.body;
	});
}

export async function saveSettings(
	token: string,
	guildId: string,
	patch: Record<string, unknown>,
	section = ''
): Promise<string | null> {
	const query = section ? `?section=${encodeURIComponent(section)}` : '';
	const reply = await call(token, guildId, `/SaveServerSettings${query}`, 'PATCH', patch);
	if (!reply?.ok) return reason(reply, 'Could not save your settings, try again.');

	settings.delete(guildId);
	return null;
}

function normalizeDocumentation(raw: Record<string, unknown>): DocumentationType {
	return {
		id: String(raw.id ?? ''),
		name: String(raw.name ?? ''),
		url: String(raw.url ?? ''),
		punishmentLevel: Number(raw.punishmentLevel ?? 0),
		faviconURL: String(raw.faviconURL ?? '')
	};
}

export async function getDocumentation(
	token: string,
	guildId: string
): Promise<DocumentationType[] | null> {
	const cached = documentation.get(guildId);
	if (cached) return cached;

	return documentation.dedupe(`documentation:${guildId}`, async () => {
		const reply = await call(token, guildId, '/GetDocumentationTypes');
		if (!reply?.ok) return documentation.stale(guildId) ?? null;

		const list = ((reply.body.documentation_types ?? []) as Record<string, unknown>[])
			.map(normalizeDocumentation)
			.filter((entry) => entry.id);

		documentation.set(guildId, list);
		return list;
	});
}

export async function createDocumentation(
	token: string,
	guildId: string,
	input: Omit<DocumentationType, 'id'>
): Promise<DocumentationType | string> {
	const reply = await call(token, guildId, '/CreateDocumentationType', 'POST', input);
	if (!reply?.ok) return reason(reply, 'Could not create that documentation type.');

	documentation.delete(guildId);
	return normalizeDocumentation({
		...input,
		...((reply.body.documentation_type ?? {}) as Record<string, unknown>)
	});
}

export async function editDocumentation(
	token: string,
	guildId: string,
	entry: DocumentationType
): Promise<string | null> {
	const reply = await call(token, guildId, `/${entry.id}/EditDocumentationType`, 'PATCH', {
		name: entry.name,
		url: entry.url,
		punishmentLevel: entry.punishmentLevel
	});
	if (!reply?.ok) return reason(reply, 'Could not update that documentation type.');

	documentation.delete(guildId);
	return null;
}

export async function deleteDocumentation(
	token: string,
	guildId: string,
	entryId: string
): Promise<string | null> {
	const reply = await call(token, guildId, `/${entryId}/DeleteDocumentationType`, 'DELETE');
	if (!reply?.ok) return reason(reply, 'Could not delete that documentation type.');

	documentation.delete(guildId);
	return null;
}

function readRoleChange(raw: Record<string, unknown>): InfractionRoleChange {
	return {
		temporary: bool(raw.temporary),
		duration: Math.max(0, num(raw.duration)),
		roles: ids(raw.roles)
	};
}

function readNotification(raw: Record<string, unknown>): InfractionNotification {
	const model =
		raw.message && typeof raw.message === 'object'
			? raw.message
			: {
					content: raw.content,
					embeds: Array.isArray(raw.embeds)
						? raw.embeds
						: raw.embed && typeof raw.embed === 'object'
							? [raw.embed]
							: [],
					components: raw.components
				};

	return {
		enabled: bool(raw.enabled),
		channel_id: id(raw.channel_id),
		message: readMessage(model)
	};
}

export function readInfractions(raw: Record<string, unknown>): InfractionSettings {
	const grouped = group(raw, 'infractions');
	const list = Array.isArray(grouped.infractions)
		? (grouped.infractions as Record<string, unknown>[])
		: [];

	return {
		infractions: list.map((entry, index) => {
			const escalation = group(entry, 'escalation');
			const roleChanges = group(entry, 'role_changes');
			const notifications = group(entry, 'notifications');
			const expiry = group(entry, 'expiry');

			return {
				id: num(entry.id, index + 1),
				name: text(entry.name),
				end_shift: bool(entry.end_shift),
				remove_ingame_perms: bool(entry.remove_ingame_perms),
				manager_roles: ids(entry.manager_roles),
				escalation: {
					threshold: Math.max(1, num(escalation.threshold, 1)),
					next_infraction: text(escalation.next_infraction)
				},
				role_changes: {
					add: readRoleChange(group(roleChanges, 'add')),
					remove: readRoleChange(group(roleChanges, 'remove'))
				},
				notifications: {
					dm: readNotification(group(notifications, 'dm')),
					public: readNotification(group(notifications, 'public'))
				},
				expiry: {
					enabled: bool(expiry.enabled),
					duration: Math.max(0, num(expiry.duration, 30))
				}
			};
		})
	};
}

export function readPriorities(raw: Record<string, unknown>): PrioritySettings {
	const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

	return {
		channel_id: id(raw.channel_id),
		mentioned_roles: ids(raw.mentioned_roles),
		blacklisted_roles: ids(raw.blacklisted_roles),
		cooldown: num(raw.cooldown),
		global_cooldown: num(raw.global_cooldown),
		min_players: num(raw.min_players),
		max_players: num(raw.max_players),
		minimum_allowed_permission: num(raw.minimum_allowed_permission),
		peacetimer: num(raw.peacetimer),
		presets: list<Record<string, unknown>>(raw.presets).map((preset) => ({
			name: text(preset.name),
			value: text(preset.value),
			time: num(preset.time)
		})),
		request_types: list<Record<string, unknown>>(raw.request_types).map((request) => ({
			name: text(request.name),
			reason: text(request.reason),
			min_players: num(request.min_players),
			max_players: num(request.max_players),
			cooldown: num(request.cooldown)
		}))
	};
}

function readStoredMessage(value: unknown): DiscordMessage {
	let raw: unknown = value;

	if (typeof value === 'string') {
		if (!value.trim()) return blankMessage();
		try {
			raw = JSON.parse(value);
		} catch {
			return blankMessage();
		}
	}

	const message = readMessage(raw);

	for (const component of message.components) {
		if (component.type !== ComponentType.ActionRow) continue;
		for (const button of component.components) {
			button.custom_id = button.custom_id.split(':')[0];
		}
	}

	return message;
}

function packSessionMessage(message: DiscordMessage, guildId: string): string {
	if (isEmptyMessage(message)) return '';

	const packed = packMessage(message);
	const components = (packed.components ?? []) as Record<string, unknown>[];

	for (const row of components) {
		if (row.type !== ComponentType.ActionRow) continue;

		for (const button of (row.components ?? []) as Record<string, unknown>[]) {
			if (button.style === 5) continue;

			if (button.custom_id === voteButtonId) button.label = '{vote_button_name}';
			if (button.custom_id === viewVotesButtonId) button.label = 'View Votes';
			button.custom_id = `${String(button.custom_id)}:${guildId}`;
		}
	}

	return JSON.stringify(packed);
}

export function readSessions(raw: Record<string, unknown>): SessionSettings {
	const sessions = group(raw, 'sessions');

	return {
		channel_id: id(sessions.channel_id),
		dynamic_button: bool(sessions.dynamic_button),
		vote_button_label: text(sessions.vote_button_label, 'Vote').slice(
			0,
			sessionLimits.voteButtonLabel
		),
		required_votes_default: Math.min(
			sessionLimits.requiredVotes,
			Math.max(1, num(sessions.required_votes_default, 5))
		),
		start_mention_roles: ids(sessions.start_mention_roles),
		poll_mention_roles: ids(sessions.poll_mention_roles),
		end_staff_shifts: bool(sessions.end_staff_shifts),
		auto_full: bool(sessions.auto_full),
		boost_threshold: Math.min(50, Math.max(0, num(sessions.boost_threshold, 0))),
		boost_mention_roles: ids(sessions.boost_mention_roles),
		auto_kick: bool(sessions.auto_kick),
		auto_kick_grace: Math.max(0, num(sessions.auto_kick_grace, 60)),
		channel_locks: {
			enabled: bool(group(sessions, 'channel_locks').enabled),
			channels: ids(group(sessions, 'channel_locks').channels),
			role: id(group(sessions, 'channel_locks').role)
		},
		vote: readStoredMessage(sessions.vote),
		staff_vote: readStoredMessage(sessions.staff_vote),
		start: readStoredMessage(sessions.start),
		boost: readStoredMessage(sessions.boost),
		full: readStoredMessage(sessions.full),
		shutdown: readStoredMessage(sessions.shutdown)
	};
}

export async function saveSessions(
	token: string,
	guildId: string,
	value: SessionSettings
): Promise<string | null> {
	return saveSettings(token, guildId, {
		sessions: {
			channel_id: value.channel_id,
			dynamic_button: value.dynamic_button,
			vote_button_label: value.vote_button_label,
			required_votes_default: value.required_votes_default,
			start_mention_roles: value.start_mention_roles,
			poll_mention_roles: value.poll_mention_roles,
			end_staff_shifts: value.end_staff_shifts,
			auto_full: value.auto_full,
			boost_threshold: value.boost_threshold,
			boost_mention_roles: value.boost_mention_roles,
			auto_kick: value.auto_kick,
			auto_kick_grace: value.auto_kick_grace,
			channel_locks: value.channel_locks,
			vote: packSessionMessage(value.vote, guildId),
			staff_vote: packSessionMessage(value.staff_vote, guildId),
			start: packSessionMessage(value.start, guildId),
			boost: packSessionMessage(value.boost, guildId),
			full: packSessionMessage(value.full, guildId),
			shutdown: packSessionMessage(value.shutdown, guildId)
		}
	});
}

export async function getPriorities(
	token: string,
	guildId: string
): Promise<PrioritySettings | null> {
	const cached = priorities.get(guildId);
	if (cached) return cached;

	return priorities.dedupe(`priorities:${guildId}`, async () => {
		const reply = await call(token, guildId, '/GetPrioritySettings');
		if (!reply?.ok) return priorities.stale(guildId) ?? null;

		const value = readPriorities(reply.body);
		priorities.set(guildId, value);
		return value;
	});
}

export async function getPriorityRequestOptions(
	token: string,
	guildId: string
): Promise<{ enabled: boolean; request_types: PriorityRequestType[] } | null> {
	const reply = await call(token, guildId, '/GetPriorityRequestOptions');
	if (!reply?.ok) return null;

	const entries = Array.isArray(reply.body.request_types)
		? (reply.body.request_types as Record<string, unknown>[])
		: [];

	return {
		enabled: reply.body.enabled === true,
		request_types: entries.map((request) => ({
			name: text(request.name),
			reason: text(request.reason),
			min_players: num(request.min_players),
			max_players: num(request.max_players),
			cooldown: num(request.cooldown)
		}))
	};
}

export interface PriorityOutcome {
	id: string;
	status: number;
	message: string;
	retryAfter: number;
}

export async function createPriority(
	token: string,
	guildId: string,
	value: { type: string; reason: string; time: number }
): Promise<PriorityOutcome> {
	const reply = await call(token, guildId, '/CreatePriority', 'POST', value);

	if (!reply) {
		return {
			id: '',
			status: 502,
			message: 'The bot is not responding right now, try again shortly.',
			retryAfter: 0
		};
	}
	if (reply.ok) return { id: text(reply.body.id), status: 200, message: '', retryAfter: 0 };

	return {
		id: '',
		status: reply.status >= 400 && reply.status <= 599 ? reply.status : 502,
		message: text(reply.body.error, 'Could not send your priority request, try again.'),
		retryAfter: num(reply.body.retry_after)
	};
}

export async function savePriorities(
	token: string,
	guildId: string,
	value: PrioritySettings
): Promise<string | null> {
	const reply = await call(token, guildId, '/SavePrioritySettings', 'POST', value);
	if (!reply?.ok) return reason(reply, 'Could not save your priority settings, try again.');

	priorities.delete(guildId);
	return null;
}

export async function getPunishmentTypes(
	token: string,
	guildId: string
): Promise<PunishmentType[] | null> {
	const cached = punishmentTypes.get(guildId);
	if (cached) return cached;

	return punishmentTypes.dedupe(`punishmentTypes:${guildId}`, async () => {
		const reply = await call(token, guildId, '/GetServerPunishmentTypesWithChannel');
		if (!reply?.ok) return punishmentTypes.stale(guildId) ?? null;

		const list = ((reply.body.PunishmentTypes ?? []) as Record<string, unknown>[])
			.map((raw) => ({
				id: text(raw.id),
				name: text(raw.name),
				channel: id(raw.channel)
			}))
			.filter((entry) => entry.name);

		punishmentTypes.set(guildId, list);
		return list;
	});
}

export async function savePunishmentType(
	token: string,
	guildId: string,
	entry: PunishmentType
): Promise<string | null> {
	const path = entry.id ? `/EditPunishmentType/${entry.id}` : '/SavePunishmentType';
	const reply = await call(token, guildId, path, entry.id ? 'PATCH' : 'POST', {
		name: entry.name,
		channel: entry.channel
	});
	if (!reply?.ok) return reason(reply, 'Could not save that punishment type.');

	punishmentTypes.delete(guildId);
	return null;
}

export async function deletePunishmentType(
	token: string,
	guildId: string,
	typeId: string
): Promise<string | null> {
	const reply = await call(token, guildId, `/DeletePunishmentType/${typeId}`, 'DELETE');
	if (!reply?.ok) return reason(reply, 'Could not delete that punishment type.');

	punishmentTypes.delete(guildId);
	return null;
}

export async function getServerLink(
	token: string,
	guildId: string
): Promise<{ linked: boolean } | null> {
	const cached = links.get(guildId);
	if (cached) return cached;

	return links.dedupe(`link:${guildId}`, async () => {
		const reply = await call(token, guildId, '/GetERLCDiscordLink');
		if (!reply?.ok) return links.stale(guildId) ?? null;

		const value = { linked: num(reply.body.Status) === 1 };

		links.set(guildId, value);
		return value;
	});
}

export interface ServerInformation {
	name: string;
	joinKey: string;
	currentPlayers: number;
	maxPlayers: number;
	queue: number;
	verification: string;
	teamBalance: boolean;
}

function serverInformation(body: Record<string, unknown>): ServerInformation {
	const queue = body.Queue;

	return {
		name: text(body.Name, 'Unnamed server'),
		joinKey: text(body.JoinKey),
		currentPlayers: num(body.CurrentPlayers),
		maxPlayers: num(body.MaxPlayers),
		queue: Array.isArray(queue) ? queue.length : num(body.QueueCount),
		verification: text(body.AccVerifiedReq),
		teamBalance: bool(body.TeamBalance)
	};
}

export async function getServerInformation(
	token: string,
	guildId: string
): Promise<ServerInformation | null> {
	const cached = servers.get(guildId);
	if (cached) return cached;

	return servers.dedupe(`server:${guildId}`, async () => {
		const reply = await call(token, guildId, '/GetGroupedERLCData');
		if (!reply?.ok) return servers.stale(guildId) ?? null;

		const value = serverInformation(reply.body);
		servers.set(guildId, value);
		return value;
	});
}

export async function previewServerKey(
	token: string,
	guildId: string,
	serverKey: string
): Promise<{ server: ServerInformation } | { message: string }> {
	const reply = await call(token, guildId, '/GetERLCServerInformation', 'POST', { serverKey });
	if (!reply?.ok) {
		return {
			message: reason(reply, 'That key did not work. Check it was copied from your server in full.')
		};
	}

	return { server: serverInformation(reply.body) };
}

export function webhookUrl(token: string): string {
	const base = env.BACKEND_PUBLIC_URL || env.VITE_INTERNAL_URL;
	if (!token || !base) return '';
	return `${base}/webhook/prc/${token}`;
}

export async function generateWebhookToken(token: string, guildId: string): Promise<string | null> {
	const reply = await call(token, guildId, '/GenerateWebhookToken', 'POST');
	if (!reply?.ok) return null;

	settings.delete(guildId);
	return text(reply.body.webhook_token) || null;
}

export async function setServerKey(
	token: string,
	guildId: string,
	serverKey: string
): Promise<string | null> {
	const reply = await call(token, guildId, '/SetERLCServerKey', 'POST', { serverKey });
	if (!reply?.ok) return reason(reply, 'Could not save that server key.');

	settings.delete(guildId);
	links.delete(guildId);
	servers.delete(guildId);
	return null;
}

export interface HistoricLog {
	username: string;
	timestamp: number;
	is_automated: boolean;
	command: string;
}

export interface RollbackAction {
	original_command: string;
	reverse_command: string;
	time_executed: number;
	executed_by: string;
}

export interface RollbackStatus {
	command: string;
	completed: boolean;
	success: boolean;
	error: string;
}

export interface RollbackProgress {
	in_progress: boolean;
	total_commands: number;
	completed_count: number;
	failure_count: number;
	success_count: number;
	percent_done: number;
	current_command: string;
	has_failed: boolean;
	error: string;
	commands: RollbackStatus[];
}

function rollbackQuery(time: number, omit: string[]): string {
	return `?time=${time}${omit.length ? `&omit=${omit.join(',')}` : ''}`;
}

export async function getHistoricLogs(
	token: string,
	guildId: string
): Promise<HistoricLog[] | null> {
	const reply = await call(token, guildId, '/GetHistoricLogs');
	if (!reply?.ok) return null;

	const documents = Array.isArray(reply.body.Logs)
		? (reply.body.Logs as Record<string, unknown>[])
		: [];

	return documents
		.flatMap((document) => (Array.isArray(document.logs) ? document.logs : []))
		.map((entry) => (entry ?? {}) as Record<string, unknown>)
		.map((entry) => ({
			username: text(entry.username, 'Unknown'),
			timestamp: num(entry.timestamp),
			is_automated: bool(entry.is_automated),
			command: text(entry.command)
		}))
		.filter((entry) => entry.command && entry.timestamp)
		.sort((first, second) => second.timestamp - first.timestamp);
}

export async function getRollbackPremortem(
	token: string,
	guildId: string,
	time: number,
	omit: string[]
): Promise<RollbackAction[] | null> {
	const reply = await call(token, guildId, `/GetPremortem${rollbackQuery(time, omit)}`);
	if (!reply?.ok) return null;

	const actions = Array.isArray(reply.body.ActionsToTake)
		? (reply.body.ActionsToTake as Record<string, unknown>[])
		: [];

	return actions.map((entry) => ({
		original_command: text(entry.original_command),
		reverse_command: text(entry.reverse_command),
		time_executed: num(entry.time_executed),
		executed_by: text(entry.executed_by, 'Unknown')
	}));
}

function rollbackProgress(raw: Record<string, unknown>): RollbackProgress {
	const commands = Array.isArray(raw.commands) ? (raw.commands as Record<string, unknown>[]) : [];

	return {
		in_progress: bool(raw.in_progress),
		total_commands: num(raw.total_commands),
		completed_count: num(raw.completed_count),
		failure_count: num(raw.failure_count),
		success_count: num(raw.success_count),
		percent_done: num(raw.percent_done),
		current_command: text(raw.current_command),
		has_failed: bool(raw.has_failed),
		error: text(raw.error),
		commands: commands.map((entry) => ({
			command: text(entry.command),
			completed: bool(entry.completed),
			success: bool(entry.success),
			error: text(entry.error)
		}))
	};
}

export async function startRollback(
	token: string,
	guildId: string,
	time: number,
	omit: string[]
): Promise<RollbackProgress | string> {
	const reply = await call(token, guildId, `/RollbackCommands${rollbackQuery(time, omit)}`);
	if (!reply?.ok) return reason(reply, 'Could not start that rollback, try again.');

	return rollbackProgress(group(reply.body, 'Progress'));
}

export async function getRollbackProgress(
	token: string,
	guildId: string
): Promise<RollbackProgress | null> {
	const reply = await call(token, guildId, '/GetRollbackProgress');
	if (!reply?.ok) return null;

	return rollbackProgress(group(reply.body, 'Progress'));
}

export async function getPermissionCatalogue(token: string, guildId: string) {
	const reply = await call(token, guildId, '/permissions/catalogue');
	if (!reply?.ok) return null;

	return Array.isArray(reply.body.groups) ? reply.body.groups : [];
}

export async function getGuildPermissions(token: string, guildId: string) {
	const reply = await call(token, guildId, '/permissions');
	if (!reply?.ok) return null;

	return {
		mode: reply.body.mode === 'custom' ? 'custom' : 'default',
		roles: Array.isArray(reply.body.roles) ? reply.body.roles : []
	};
}

export async function saveGuildPermissions(
	token: string,
	guildId: string,
	roles: unknown[]
): Promise<string | null> {
	const reply = await call(token, guildId, '/permissions', 'PATCH', { roles });
	if (!reply?.ok) return reason(reply, 'Could not save those permissions, try again.');

	return null;
}

export function readVerification(raw: Record<string, unknown> | null): VerificationSettings {
	const verification = raw ? group(raw, 'verification') : {};

	return {
		enabled: bool(verification.enabled),
		auto_verify: verification.auto_verify === undefined ? true : bool(verification.auto_verify),
		command_enabled:
			verification.command_enabled === undefined ? true : bool(verification.command_enabled),
		channel_id: id(verification.channel_id),
		verified_roles: ids(verification.verified_roles),
		unverified_roles: ids(verification.unverified_roles),
		nickname: text(verification.nickname).slice(0, nicknameLimit),
		min_account_age: Math.min(maxAccountAge, Math.max(0, num(verification.min_account_age, 0))),
		dm_enabled: bool(verification.dm_enabled),
		message: readStoredMessage(verification.message),
		dm_message: readStoredMessage(verification.dm_message)
	};
}

export async function saveVerification(
	token: string,
	guildId: string,
	value: VerificationSettings
): Promise<string | null> {
	return saveSettings(
		token,
		guildId,
		{
			verification: {
				enabled: value.enabled,
				auto_verify: value.auto_verify,
				command_enabled: value.command_enabled,
				channel_id: value.channel_id,
				verified_roles: value.verified_roles,
				unverified_roles: value.unverified_roles,
				nickname: value.nickname,
				min_account_age: value.min_account_age,
				dm_enabled: value.dm_enabled,
				message: packVerificationMessage(value.message),
				dm_message: packVerificationMessage(value.dm_message)
			}
		},
		'verification'
	);
}

export async function sendVerificationMessage(
	token: string,
	guildId: string
): Promise<string | null> {
	const reply = await call(token, guildId, '/verification/message', 'POST', {});
	if (!reply?.ok) return reason(reply, 'Could not post the verify message, try again.');

	return null;
}
