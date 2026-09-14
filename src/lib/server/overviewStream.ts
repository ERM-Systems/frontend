import { getOverviewSettings, overviewLive, type OverviewLive } from './overview';

type Listener = (snapshot: OverviewLive) => void;

interface Channel {
	listeners: Set<Listener>;
	timer: ReturnType<typeof setInterval>;
	last: OverviewLive | null;
}

export const streamInterval = 30_000;

const channels = new Map<string, Channel>();

async function tick(guildId: string) {
	const channel = channels.get(guildId);
	if (!channel || !channel.listeners.size) return;

	try {
		const settings = await getOverviewSettings(guildId);
		if (!settings.enabled) return;

		const snapshot = await overviewLive(guildId, settings);
		channel.last = snapshot;

		for (const listener of channel.listeners) listener(snapshot);
	} catch (error) {
		console.warn(`overview stream ${guildId} failed:`, error);
	}
}

export function subscribe(guildId: string, listener: Listener): () => void {
	let channel = channels.get(guildId);

	if (!channel) {
		channel = {
			listeners: new Set(),
			timer: setInterval(() => void tick(guildId), streamInterval),
			last: null
		};
		channels.set(guildId, channel);
	}

	channel.listeners.add(listener);

	return () => {
		const current = channels.get(guildId);
		if (!current) return;

		current.listeners.delete(listener);
		if (current.listeners.size) return;

		clearInterval(current.timer);
		channels.delete(guildId);
	};
}

export function lastSnapshot(guildId: string): OverviewLive | null {
	return channels.get(guildId)?.last ?? null;
}
