export interface SeenName {
	name: string;
	id: string;
	at: number;
}

export const suggestionLimit = 8;

export function indexNames(entries: SeenName[]): SeenName[] {
	const seen = new Map<string, SeenName>();

	for (const entry of entries) {
		const name = entry.name.trim();
		if (!name) continue;

		const key = name.toLowerCase();
		const previous = seen.get(key);
		const cased = !previous || entry.at > previous.at || (entry.at === previous.at && name !== key);

		seen.set(key, {
			name: cased ? name : previous.name,
			id: entry.id || previous?.id || '',
			at: Math.max(entry.at, previous?.at ?? 0)
		});
	}

	return [...seen.values()].sort((a, b) => b.at - a.at);
}

export function matchNames(query: string, names: SeenName[], max = suggestionLimit): SeenName[] {
	const term = query.trim().toLowerCase();
	if (!term) return names.slice(0, max);

	const tier = (name: string) => {
		const value = name.toLowerCase();
		if (value === term) return 0;
		if (value.startsWith(term)) return 1;
		return value.includes(term) ? 2 : 3;
	};

	return names
		.map((entry) => ({ entry, rank: tier(entry.name) }))
		.filter((row) => row.rank < 3)
		.sort((a, b) => a.rank - b.rank || b.entry.at - a.entry.at)
		.slice(0, max)
		.map((row) => row.entry);
}
