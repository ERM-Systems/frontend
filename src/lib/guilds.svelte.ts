import type { Guild } from './server/guilds';

export const guildCache = $state<{ list: Guild[] | null | undefined }>({ list: undefined });

const orderKey = 'guildOrder';

export function readOrder(): string[] {
	try {
		const stored = JSON.parse(localStorage.getItem(orderKey) ?? '[]');
		return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
	} catch {
		return [];
	}
}

export function writeOrder(ids: string[]) {
	localStorage.setItem(orderKey, JSON.stringify(ids));
}
