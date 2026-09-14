const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat('en-GB', {
	day: '2-digit',
	month: '2-digit',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hour12: true
});

const steps: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31_536_000],
	['month', 2_592_000],
	['week', 604_800],
	['day', 86_400],
	['hour', 3600],
	['minute', 60]
];

export function relativeTime(seconds: number): string {
	if (!seconds) return 'Never';

	const difference = seconds - Date.now() / 1000;
	for (const [unit, size] of steps) {
		if (Math.abs(difference) >= size) return relative.format(Math.round(difference / size), unit);
	}

	return relative.format(Math.round(difference), 'second');
}

export function exactTime(seconds: number): string {
	if (!seconds) return '';

	return absolute
		.format(seconds * 1000)
		.replace(',', '')
		.toUpperCase();
}

export function duration(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);

	return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function defaultAvatar(userId: string): string {
	let index: bigint;

	try {
		index = (BigInt(userId) >> 22n) % 6n;
	} catch {
		index = 0n;
	}

	return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function pageSlice<T>(items: T[], page: number, perPage: number): T[] {
	return items.slice((page - 1) * perPage, page * perPage);
}
