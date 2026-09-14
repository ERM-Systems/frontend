interface Entry {
	count: number;
	window: number;
	level: number;
	next: number;
	seen: number;
}

const quota = 25;
const window = 3_000;
const ceiling = 60_000;
const forget = 300_000;
const max = 5_000;

const entries = new Map<string, Entry>();

function cooldown(level: number): number {
	return Math.min(window * 2 ** level, ceiling);
}

function prune(now: number) {
	for (const [key, entry] of entries) {
		if (now - entry.seen > forget) entries.delete(key);
	}
	if (entries.size < max) return;

	const overflow = entries.size - Math.floor(max / 2);
	for (const key of [...entries.keys()].slice(0, overflow)) entries.delete(key);
}

export function throttle(key: string): number {
	const now = Date.now();
	const entry = entries.get(key);

	if (!entry) {
		if (entries.size >= max) prune(now);
		entries.set(key, { count: 1, window: now, level: 0, next: 0, seen: now });
		return 0;
	}

	if (now - entry.seen > forget) entry.level = 0;
	entry.seen = now;

	if (now < entry.next) return entry.next - now;

	if (now - entry.window >= window) {
		entry.count = 0;
		entry.window = now;
	}

	entry.count += 1;
	if (entry.count <= quota) return 0;

	const wait = cooldown(entry.level);
	entry.level = Math.min(entry.level + 1, 5);
	entry.next = now + wait;
	entry.count = 0;
	entry.window = now + wait;

	return wait;
}

export function throttleMessage(wait: number): string {
	const seconds = Math.max(1, Math.ceil(wait / 1000));
	return `You are doing that too fast, try again in ${seconds} second${seconds === 1 ? '' : 's'}.`;
}
