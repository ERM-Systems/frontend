import { env } from '$env/dynamic/private';
import { revokeSession } from './session';

interface Reply {
	ok: boolean;
	status: number;
	body: Record<string, unknown>;
}

export interface AnalyticsPoint {
	timestamp: number;
	players: number;
	queue: number;
	kills: number;
	commands: number;
	moderations: number;
	onDuty: number;
}

const timeout = 15_000;

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

function branch(raw: Record<string, unknown>, key: string): Record<string, unknown> {
	const value = raw[key];
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readPoint(raw: Record<string, unknown>): AnalyticsPoint {
	const erlc = branch(raw, 'erlc');
	const server = branch(erlc, 'server');
	const stats = branch(server, 'stats');
	const discord = branch(raw, 'discord');
	const shifts = branch(discord, 'shifts');
	const moderations = branch(discord, 'moderations');

	return {
		timestamp: Number(raw.timestamp ?? 0),
		players: Number(branch(erlc, 'players').ingame ?? 0),
		queue: Number(server.queue ?? 0),
		kills: Number(stats.kills ?? 0),
		commands: Number(stats.commands ?? 0),
		moderations: Number(moderations.total ?? 0),
		onDuty: Number(shifts.online ?? 0)
	};
}

export async function getAnalytics(
	token: string,
	guildId: string,
	start: number,
	end: number
): Promise<AnalyticsPoint[]> {
	const reply = await call(token, guildId, `/GetAnalytics?start=${start}&end=${end}`);
	if (!reply?.ok) return [];

	const data = Array.isArray(reply.body.data) ? reply.body.data : [];

	return (data as Record<string, unknown>[])
		.map(readPoint)
		.filter((point) => Number.isFinite(point.timestamp) && point.timestamp > 0)
		.sort((a, b) => a.timestamp - b.timestamp);
}
