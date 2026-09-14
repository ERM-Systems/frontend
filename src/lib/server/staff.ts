import { env } from '$env/dynamic/private';
import { TtlCache } from './cache';
import { revokeSession } from './session';

interface Reply {
	ok: boolean;
	status: number;
	body: Record<string, unknown>;
}

export interface Infraction {
	id: string;
	userId: string;
	username: string;
	type: string;
	reason: string;
	issuer: string;
	timestamp: number;
	escalated: boolean;
	revoked: boolean;
	revokedAt: number;
}

export interface ShiftBreak {
	start: number;
	end: number;
}

export interface ShiftRecord {
	id: string;
	userId: string;
	username: string;
	nickname: string;
	type: string;
	start: number;
	end: number;
	duration: number;
	addedTime: number;
	removedTime: number;
	breaks: ShiftBreak[];
	moderations: number;
}

export interface SavedCode {
	code: string;
	createdAt: number;
}

export interface ModerationLog {
	id: string;
	username: string;
	type: string;
	reason: string;
	timestamp: number;
}

export interface MemberResult {
	userId: string;
	username: string;
	displayName: string;
	avatarUrl: string;
}

export interface Punishment {
	id: string;
	username: string;
	type: string;
	reason: string;
	moderator: string;
	timestamp: number;
	until: number;
}

export interface UserRoles {
	username: string;
	roles: string[];
}

export interface WaveUser {
	userId: string;
	username: string;
	rank: string;
	shiftTime: number;
	requiredQuota: number;
	metQuota: boolean;
	infractionType: string;
	skippedLoa: boolean;
}

export interface WavePreview {
	totalUsers: number;
	belowQuota: number;
	aboveQuota: number;
	skippedLoa: number;
	periodStart: number;
	periodEnd: number;
	users: WaveUser[];
}

export interface WaveInput {
	infractionType: string;
	period: number;
	omitLoas: boolean;
}

export interface WaveTarget {
	userId: string;
	username: string;
}

const ttl = 60_000;
const timeout = 10_000;

const shifts = new TtlCache<ShiftRecord[]>(ttl);

async function call(
	token: string,
	guildId: string,
	path: string,
	method = 'GET',
	payload?: unknown,
	timeoutMs = timeout
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
			signal: AbortSignal.timeout(timeoutMs)
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

function list(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function number(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function string(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function idOf(value: unknown): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return '';
}

function readInfraction(raw: Record<string, unknown>, position: number): Infraction {
	return {
		id: string(raw.id) || `infraction-${position}`,
		userId: string(raw.user_id),
		username: string(raw.username),
		type: string(raw.type),
		reason: string(raw.reason),
		issuer: string(raw.issuer_username),
		timestamp: number(raw.timestamp),
		escalated: raw.escalated === true,
		revoked: raw.revoked === true,
		revokedAt: number(raw.revoked_at)
	};
}

export async function getInfractions(token: string, guildId: string): Promise<Infraction[] | null> {
	const reply = await call(token, guildId, '/Infractions');
	if (!reply?.ok) return null;

	return list(reply.body.data).map(readInfraction);
}

export async function getUserInfractions(
	token: string,
	guildId: string,
	userId: string
): Promise<Infraction[] | null> {
	const reply = await call(token, guildId, `/${userId}/Infractions`);
	if (!reply?.ok) return null;

	return list(reply.body.infractions)
		.map(readInfraction)
		.sort((a, b) => b.timestamp - a.timestamp);
}

export async function editInfraction(
	token: string,
	guildId: string,
	infractionId: string,
	type: string,
	text: string
): Promise<string | null> {
	const reply = await call(token, guildId, `/Infractions/${infractionId}`, 'PATCH', {
		type,
		reason: text
	});
	if (!reply?.ok) return reason(reply, 'Could not edit that infraction, try again shortly.');

	return null;
}

export async function revokeInfraction(
	token: string,
	guildId: string,
	infractionId: string
): Promise<string | null> {
	const reply = await call(token, guildId, `/Infractions/${infractionId}/Revoke`, 'PATCH');
	if (!reply?.ok) return reason(reply, 'Could not revoke that infraction, try again shortly.');

	return null;
}

export async function deleteInfraction(
	token: string,
	guildId: string,
	infractionId: string
): Promise<string | null> {
	const reply = await call(token, guildId, `/Infractions/${infractionId}`, 'DELETE');
	if (!reply?.ok) return reason(reply, 'Could not delete that infraction, try again shortly.');

	return null;
}

function readShift(raw: Record<string, unknown>): ShiftRecord {
	const start = number(raw.StartEpoch);
	const end = string(raw.EndEpoch) === '0' ? 0 : number(raw.EndEpoch);
	const added = number(raw.AddedTime);
	const removed = number(raw.RemovedTime);

	const breaks = list(raw.Breaks).map((entry) => ({
		start: number(entry.StartEpoch),
		end: number(entry.EndEpoch)
	}));

	const paused = breaks.reduce(
		(total, entry) => (entry.end > entry.start ? total + (entry.end - entry.start) : total),
		0
	);

	return {
		id: string(raw.ID),
		userId: string(raw.UserID),
		username: string(raw.Username),
		nickname: string(raw.Nickname),
		type: string(raw.Type),
		start,
		end,
		duration: end ? Math.max(0, end - start + added - removed - paused) : 0,
		addedTime: added,
		removedTime: removed,
		breaks,
		moderations: list(raw.Moderations).length
	};
}

export function clearShifts(guildId: string) {
	shifts.delete(guildId);
}

export async function getShifts(token: string, guildId: string): Promise<ShiftRecord[] | null> {
	const cached = shifts.get(guildId);
	if (cached) return cached;

	return shifts.dedupe(`shifts:${guildId}`, async () => {
		const reply = await call(token, guildId, '/GetServerShifts');
		if (!reply?.ok) return shifts.stale(guildId) ?? null;

		const records = list(reply.body.Shifts)
			.map(readShift)
			.filter((record) => record.userId && record.start);

		shifts.set(guildId, records);
		return records;
	});
}

export async function getUserShifts(
	token: string,
	guildId: string,
	userId: string
): Promise<ShiftRecord[] | null> {
	const reply = await call(token, guildId, `/${userId}/GetUserShifts`);
	if (!reply?.ok) return null;

	return list(reply.body.Shifts)
		.map(readShift)
		.filter((record) => record.start)
		.sort((a, b) => b.start - a.start);
}

export async function getUserRoles(
	token: string,
	guildId: string,
	userId: string
): Promise<UserRoles | null> {
	const reply = await call(token, guildId, `/${userId}/GetUserRoles`);
	if (!reply?.ok) return null;

	const roles = Array.isArray(reply.body.roles) ? reply.body.roles : [];

	return {
		username: string(reply.body.username),
		roles: roles.filter((role): role is string => typeof role === 'string')
	};
}

export async function getUserPunishments(
	token: string,
	guildId: string,
	userId: string
): Promise<Punishment[] | null> {
	const reply = await call(token, guildId, `/GetModerations?UserID=${userId}`);
	if (!reply?.ok) return null;

	return list(reply.body.Moderations)
		.map((raw, position) => ({
			id: string(raw.ID) || `punishment-${position}`,
			username: string(raw.Username),
			type: string(raw.Type),
			reason: string(raw.Reason),
			moderator: string(raw.Moderator),
			timestamp: number(raw.Epoch),
			until: number(raw.UntilEpoch)
		}))
		.sort((a, b) => b.timestamp - a.timestamp);
}

export interface PunishmentPreset {
	name: string;
	result: string;
	type: string;
	permissionLevel: number;
}

export async function getPunishmentPresets(
	token: string,
	guildId: string
): Promise<PunishmentPreset[] | null> {
	const reply = await call(token, guildId, '/GetServerPunishmentPresets');
	if (!reply?.ok) return null;

	return list(reply.body.presets)
		.map((raw) => ({
			name: string(raw.name),
			result: string(raw.result),
			type: string(raw.type),
			permissionLevel: number(raw.permissionLevel)
		}))
		.filter((preset) => preset.name);
}

export async function savePunishmentPreset(
	token: string,
	guildId: string,
	preset: PunishmentPreset,
	oldName = ''
): Promise<string | null> {
	const reply = oldName
		? await call(
				token,
				guildId,
				`/EditServerPunishmentPreset?oldName=${encodeURIComponent(oldName)}`,
				'PATCH',
				preset
			)
		: await call(token, guildId, '/SetServerPunishmentPreset', 'POST', preset);

	if (reply?.status === 409) return `You already have a preset called ${preset.name}.`;
	if (!reply?.ok) return reason(reply, 'Could not save that preset, try again shortly.');

	return null;
}

export async function deletePunishmentPreset(
	token: string,
	guildId: string,
	name: string
): Promise<string | null> {
	const reply = await call(
		token,
		guildId,
		`/DeleteServerPunishmentPreset?name=${encodeURIComponent(name)}`,
		'DELETE'
	);
	if (!reply?.ok) return reason(reply, 'Could not delete that preset, try again shortly.');

	return null;
}

function readPreview(body: Record<string, unknown>): WavePreview | null {
	const raw = body.preview;
	if (!raw || typeof raw !== 'object') return null;

	const preview = raw as Record<string, unknown>;

	return {
		totalUsers: number(preview.total_users),
		belowQuota: number(preview.users_below_quota),
		aboveQuota: number(preview.users_above_quota),
		skippedLoa: number(preview.users_skipped_loa),
		periodStart: number(preview.period_start),
		periodEnd: number(preview.period_end),
		users: list(body.users).map((user) => ({
			userId: idOf(user.user_id),
			username: string(user.username) || 'Unknown member',
			rank: string(user.rank),
			shiftTime: number(user.shift_time),
			requiredQuota: number(user.required_quota),
			metQuota: user.met_quota === true,
			infractionType: string(user.infraction_type),
			skippedLoa: user.skipped_loa === true
		}))
	};
}

function waveBody(input: WaveInput): Record<string, unknown> {
	return {
		infract_type: input.infractionType,
		omit_loas: input.omitLoas,
		...(input.period > 0 ? { period: input.period } : {})
	};
}

export async function previewWave(
	token: string,
	guildId: string,
	input: WaveInput
): Promise<{ preview: WavePreview } | { message: string }> {
	const reply = await call(token, guildId, '/InfractionWavePremortem', 'POST', waveBody(input));
	if (!reply?.ok) {
		return { message: reason(reply, 'Could not preview that wave, try again shortly.') };
	}

	const preview = readPreview(reply.body);
	if (!preview) {
		return { message: 'ERM sent back a preview we could not read. Try again in a moment.' };
	}

	return { preview };
}

export async function startWave(
	token: string,
	guildId: string,
	input: WaveInput
): Promise<string | null> {
	const reply = await call(token, guildId, '/StartInfractionWave', 'POST', {
		...waveBody(input),
		infract_violators: true
	});
	if (!reply?.ok) return reason(reply, 'Could not start that wave, try again shortly.');

	return null;
}

export interface WaveResult {
	userId: string;
	ok: boolean;
	message: string;
}

export async function createInfraction(
	token: string,
	guildId: string,
	issuer: { discordId: string; username: string },
	target: WaveTarget,
	infractionType: string,
	reasonText: string
): Promise<string | null> {
	const reply = await call(
		token,
		guildId,
		'/CreateInfraction',
		'POST',
		{
			user_id: target.userId,
			username: target.username,
			guild_id: guildId,
			type: infractionType,
			reason: reasonText,
			issuer_id: issuer.discordId,
			issuer_username: issuer.username
		},
		20_000
	);
	if (!reply?.ok) return reason(reply, 'Could not issue this infraction.');

	return null;
}

export async function issueInfractions(
	token: string,
	guildId: string,
	issuer: { discordId: string; username: string },
	targets: WaveTarget[],
	infractionType: string,
	reasonText: string
): Promise<WaveResult[]> {
	return Promise.all(
		targets.map(async (target) => {
			const message = await createInfraction(
				token,
				guildId,
				issuer,
				target,
				infractionType,
				reasonText
			);

			return { userId: target.userId, ok: !message, message: message ?? '' };
		})
	);
}

export async function addShiftTime(
	token: string,
	guildId: string,
	shiftId: string,
	seconds: number
): Promise<string | null> {
	const reply = await call(token, guildId, `/AddTime/${shiftId}`, 'POST', { seconds });
	if (!reply?.ok) return reason(reply, 'Could not add time to that shift, try again shortly.');

	shifts.delete(guildId);
	return null;
}

export async function removeShiftTime(
	token: string,
	guildId: string,
	shiftId: string,
	seconds: number
): Promise<string | null> {
	const reply = await call(token, guildId, `/RemoveTime/${shiftId}`, 'POST', { seconds });
	if (!reply?.ok) return reason(reply, 'Could not remove time from that shift, try again shortly.');

	shifts.delete(guildId);
	return null;
}

export async function forceStartShift(
	token: string,
	guildId: string,
	userId: string,
	type: string
): Promise<{ shiftId: string } | { message: string }> {
	const reply = await call(token, guildId, `/ForceStartShift/${userId}`, 'POST', { type });
	if (!reply?.ok) return { message: reason(reply, 'Could not start a shift for that member.') };

	shifts.delete(guildId);

	const raw = reply.body.shift;
	const shiftId = raw && typeof raw === 'object' ? string((raw as Record<string, unknown>).ID) : '';

	return { shiftId };
}

export async function forceEndShift(
	token: string,
	guildId: string,
	shiftId: string
): Promise<string | null> {
	const reply = await call(token, guildId, `/ForceEndShift/${shiftId}`, 'POST');
	if (!reply?.ok) return reason(reply, 'Could not end that shift, try again shortly.');

	shifts.delete(guildId);
	return null;
}

export async function voidShift(
	token: string,
	guildId: string,
	shiftId: string
): Promise<string | null> {
	const reply = await call(token, guildId, `/VoidShift/${shiftId}`, 'DELETE');
	if (!reply?.ok) return reason(reply, 'Could not void that shift, try again shortly.');

	shifts.delete(guildId);
	return null;
}

export async function toggleMemberBreak(
	token: string,
	guildId: string,
	userId: string
): Promise<string | null> {
	const reply = await call(token, guildId, `/${userId}/AdminToggleBreak`, 'POST');
	if (!reply?.ok) return reason(reply, 'Could not toggle that break, try again shortly.');

	shifts.delete(guildId);
	return null;
}

export async function saveShiftSnapshot(
	token: string,
	guildId: string
): Promise<{ code: string } | { message: string }> {
	const reply = await call(token, guildId, '/SaveServerShifts', 'POST', undefined, 30_000);
	if (!reply?.ok)
		return { message: reason(reply, 'Could not save a snapshot, try again shortly.') };

	const code = string(reply.body.code);
	if (!code) {
		return { message: 'ERM sent back a snapshot we could not read. Try again in a moment.' };
	}

	return { code };
}

export async function getSnapshotShifts(
	token: string,
	guildId: string,
	code: string
): Promise<ShiftRecord[] | null> {
	const reply = await call(token, guildId, '/GetSavedShifts', 'POST', { code }, 30_000);
	if (!reply?.ok) return null;
	if (string(reply.body.guild_id) !== guildId) return null;

	return list(reply.body.shifts)
		.map(readShift)
		.filter((record) => record.userId && record.start);
}

export async function getSnapshotCodes(
	token: string,
	guildId: string
): Promise<SavedCode[] | null> {
	const reply = await call(token, guildId, '/GetSavedShiftCodes');
	if (!reply?.ok) return null;

	return list(reply.body.codes)
		.map((entry) => ({ code: string(entry.code), createdAt: number(entry.created_at) }))
		.filter((entry) => entry.code);
}

export async function deleteSnapshotCode(
	token: string,
	guildId: string,
	code: string
): Promise<string | null> {
	const reply = await call(token, guildId, `/DeleteSavedShiftCode/${code}`, 'DELETE');
	if (!reply?.ok) return reason(reply, 'Could not delete that snapshot, try again shortly.');

	return null;
}

export async function restoreSnapshot(
	token: string,
	guildId: string,
	code: string
): Promise<string | null> {
	const reply = await call(token, guildId, `/RestoreShifts/${code}`, 'POST', undefined, 30_000);
	if (!reply?.ok) return reason(reply, 'Could not restore that snapshot, try again shortly.');

	shifts.delete(guildId);
	return null;
}

export async function getModeratorLogs(
	token: string,
	guildId: string,
	userId: string
): Promise<ModerationLog[] | null> {
	const reply = await call(token, guildId, `/GetModeratorActivityInfo/${userId}`);
	if (!reply?.ok) return null;

	return list(reply.body.Moderations)
		.map((raw, position) => ({
			id: string(raw.ID) || `log-${position}`,
			username: string(raw.Username) || 'Unknown',
			type: string(raw.Type),
			reason: string(raw.Reason),
			timestamp: number(raw.Epoch)
		}))
		.sort((a, b) => b.timestamp - a.timestamp);
}

export async function searchMembers(
	token: string,
	guildId: string,
	query: string
): Promise<MemberResult[] | null> {
	const reply = await call(token, guildId, `/SearchMembers?query=${encodeURIComponent(query)}`);
	if (!reply?.ok) return null;

	return list(reply.body.members)
		.map((entry) => {
			const user = (entry.user ?? {}) as Record<string, unknown>;

			return {
				userId: string(user.id),
				username: string(user.username),
				displayName: string(user.global_name) || string(entry.nick) || string(user.username),
				avatarUrl: string(user.avatar)
			};
		})
		.filter((member) => member.userId);
}
