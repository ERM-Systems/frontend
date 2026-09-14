import { env } from '$env/dynamic/private';
import { discordFallbackAvatar } from '$lib/panel';
import { getDiscordProfile } from './panel';
import { revokeSession } from './session';

interface Reply {
	ok: boolean;
	status: number;
	body: Record<string, unknown>;
}

export interface AuditEntry {
	id: string;
	timestamp: number;
	userId: string;
	username: string;
	avatarUrl: string;
	accessLevel: string;
	action: string;
	path: string;
	details: unknown;
}

export interface AuditLog {
	entries: AuditEntry[];
	total: number;
}

export const auditPerPage = 25;

const timeout = 10_000;

async function call(token: string, guildId: string, path: string): Promise<Reply | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}/${guildId}${path}`, {
			headers: { Authorization: token },
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

function readEntry(raw: Record<string, unknown>, position: number): AuditEntry {
	const timestamp = Number(raw.timestamp);

	return {
		id: String(raw.id ?? `entry-${position}`),
		timestamp: Number.isFinite(timestamp) ? timestamp : 0,
		userId: String(raw.user_id ?? ''),
		username: String(raw.username ?? ''),
		avatarUrl: '',
		accessLevel: String(raw.access_level ?? ''),
		action: String(raw.action ?? ''),
		path: String(raw.path ?? ''),
		details: raw.details ?? null
	};
}

export async function getAuditLog(
	token: string,
	guildId: string,
	page: number
): Promise<AuditLog | null> {
	const offset = Math.max(0, page - 1) * auditPerPage;
	const reply = await call(
		token,
		guildId,
		`/GetGuildAuditLogs?limit=${auditPerPage}&offset=${offset}`
	);
	if (!reply?.ok) return null;

	const list = Array.isArray(reply.body.logs) ? (reply.body.logs as Record<string, unknown>[]) : [];
	const total = Number(reply.body.total);
	const entries = list.map(readEntry);

	const avatars = new Map<string, string>();
	await Promise.all(
		[...new Set(entries.map((entry) => entry.userId).filter(Boolean))].map(async (userId) => {
			const profile = await getDiscordProfile(token, userId);
			avatars.set(userId, profile.avatarUrl);
		})
	);

	for (const entry of entries) {
		entry.avatarUrl = avatars.get(entry.userId) ?? discordFallbackAvatar;
	}

	return {
		entries,
		total: Number.isFinite(total) ? total : list.length
	};
}
