import { env } from '$env/dynamic/private';
import { TtlCache } from './cache';

type Endpoints = Record<string, { serviceId: string; health: string }>;

interface UptimeSummary {
	message: string;
	statusReport: Record<string, Endpoints>;
}

interface ShardData {
	ShardPings: Record<string, number>;
	TotalGuilds: number;
	TotalUsers: number;
}

export type State = 'operational' | 'degraded' | 'down' | 'unknown';

export interface Group {
	up: number;
	total: number;
	state: State;
}

export interface Shard {
	id: number;
	ping: number;
}

export interface Status {
	shards: Group;
	services: Group;
	list: Shard[];
}

const expectedMs = 150;
const minHealthyShards = 25;
const ttl = 20_000;
const key = 'status';

const unknown: Group = { up: 0, total: 0, state: 'unknown' };
const empty: Status = { shards: unknown, services: unknown, list: [] };

const cache = new TtlCache<Status>(ttl);

function rollUp(up: number, down: number, total: number): State {
	if (!total) return 'unknown';
	if (down > 0) return 'down';
	return up === total ? 'operational' : 'degraded';
}

async function get<T>(fetch: typeof globalThis.fetch, path: string): Promise<T | null> {
	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}${path}`, {
			signal: AbortSignal.timeout(5000)
		});
		return response.ok ? ((await response.json()) as T) : null;
	} catch {
		return null;
	}
}

async function fetchStatus(fetch: typeof globalThis.fetch): Promise<Status> {
	const [shardData, uptime] = await Promise.all([
		get<ShardData>(fetch, '/Status/GetShards'),
		get<UptimeSummary>(fetch, '/Status/GetUptimeSummary')
	]);

	if (!shardData && !uptime) return cache.stale(key) ?? empty;

	const list: Shard[] = Object.entries(shardData?.ShardPings ?? {})
		.map(([id, ping]) => ({ id: Number(id), ping }))
		.sort((a, b) => a.id - b.id);

	let shards = unknown;
	if (list.length) {
		const down = list.filter((shard) => shard.ping <= 0).length;
		const healthy = list.filter((shard) => shard.ping > 0 && shard.ping < expectedMs).length;
		shards = {
			up: list.length - down,
			total: list.length,
			state: down > 0 ? 'down' : healthy >= minHealthyShards ? 'operational' : 'degraded'
		};
	}

	let services = unknown;
	if (uptime?.statusReport) {
		const groups = Object.values(uptime.statusReport);
		let up = 0;
		let down = 0;
		for (const endpoints of groups) {
			const healthy = Object.values(endpoints).filter((e) => e.health === 'up').length;
			if (healthy === Object.keys(endpoints).length) up++;
			else if (healthy === 0) down++;
		}
		services = { up, total: groups.length, state: rollUp(up, down, groups.length) };
	}

	const status: Status = { shards, services, list };
	cache.set(key, status);
	return status;
}

export function getStatus(fetch: typeof globalThis.fetch): Promise<Status> {
	if (!env.VITE_INTERNAL_URL) return Promise.resolve(empty);

	const cached = cache.get(key);
	if (cached) return Promise.resolve(cached);

	return cache.dedupe(key, () => fetchStatus(fetch));
}
