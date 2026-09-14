import { env } from '$env/dynamic/private';
import type { ActiveSession, SessionHistoryEntry } from '$lib/sessions';
import { revokeSession } from './session';

interface Reply {
	ok: boolean;
	status: number;
	body: Record<string, unknown>;
}

const timeout = 15_000;

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

const unconfigured = 'The sessions module has not been configured correctly yet.';

function reason(reply: Reply | null, fallback: string): string {
	const message = reply?.body.message;
	if (typeof message !== 'string' || !message) return fallback;
	if (/not (?:been )?configured/i.test(message)) return unconfigured;

	return message;
}

function readSession(raw: Record<string, unknown>): ActiveSession {
	const counts = Array.isArray(raw.player_counts) ? raw.player_counts : [];

	return {
		started: raw.started === true,
		dynamic: raw.dynamic === true,
		votes: Number(raw.votes ?? 0),
		requiredVotes: Number(raw.required_votes ?? 0),
		votedUsers: (Array.isArray(raw.voted_users) ? raw.voted_users : []).map(String),
		startedBy: String(raw.started_by ?? ''),
		maxPlayers: Number(raw.max_players ?? 0),
		playerCounts: counts.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry)),
		channelId: String(raw.channel_id ?? ''),
		messageId: String(raw.message_id ?? ''),
		voteMessageId: String(raw.vote_message_id ?? ''),
		playersInGame: Number(raw.players_in_game ?? -1),
		votersInGame: Number(raw.voters_in_game ?? 0),
		votersLinked: Number(raw.voters_linked ?? 0)
	};
}

export async function getActiveSession(
	token: string,
	guildId: string
): Promise<ActiveSession | null> {
	const reply = await call(token, guildId, '/GetActiveSession');
	if (!reply?.ok) return null;

	const raw = reply.body.session;
	return raw && typeof raw === 'object' ? readSession(raw as Record<string, unknown>) : null;
}

export async function getSessionHistory(
	token: string,
	guildId: string
): Promise<SessionHistoryEntry[]> {
	const reply = await call(token, guildId, '/GetSessionHistory?limit=50');
	if (!reply?.ok) return [];

	const list = Array.isArray(reply.body.history) ? reply.body.history : [];

	return (list as Record<string, unknown>[]).map((raw) => ({
		id: String(raw.id ?? ''),
		startedBy: String(raw.started_by ?? ''),
		endedBy: String(raw.ended_by ?? ''),
		startedAt: Number(raw.started_at ?? 0),
		endedAt: Number(raw.ended_at ?? 0),
		votes: Number(raw.votes ?? 0),
		votedUsers: (Array.isArray(raw.voted_users) ? raw.voted_users : []).map(String),
		maxPlayers: Number(raw.max_players ?? 0),
		playerCounts: (Array.isArray(raw.player_counts) ? raw.player_counts : []).map(Number),
		commands: Number(raw.commands ?? 0),
		kills: Number(raw.kills ?? 0),
		joins: Number(raw.joins ?? 0)
	}));
}

export async function deleteSession(
	token: string,
	guildId: string,
	sessionId: string
): Promise<string | null> {
	const reply = await call(token, guildId, `/SessionHistory/${sessionId}`, 'DELETE');
	if (!reply?.ok) return reason(reply, 'Could not delete that session, try again.');

	return null;
}

export async function createSessionVote(
	token: string,
	guildId: string,
	requiredVotes: number
): Promise<string | null> {
	const reply = await call(token, guildId, '/CreateSessionVote', 'POST', {
		required_votes: requiredVotes
	});
	if (!reply?.ok) return reason(reply, 'Could not post that session vote, try again.');

	return null;
}

export async function startSession(token: string, guildId: string): Promise<string | null> {
	const reply = await call(token, guildId, '/StartSession', 'POST', {});
	if (!reply?.ok) return reason(reply, 'Could not start that session, try again.');

	return null;
}

export async function endSession(token: string, guildId: string): Promise<string | null> {
	const reply = await call(token, guildId, '/EndSession', 'POST', {});
	if (!reply?.ok) return reason(reply, 'Could not end that session, try again.');

	return null;
}
