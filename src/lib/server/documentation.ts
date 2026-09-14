import { validDocumentationUrl } from '$lib/settings';
import { TtlCache } from './cache';

export interface SiteIcon {
	type: string;
	body: Uint8Array<ArrayBuffer>;
}

export const iconTtl = 7 * 24 * 60 * 60;

const missTtl = 60 * 60 * 1000;
const timeout = 4000;
const maxBytes = 256 * 1024;
const maxHops = 3;

const iconHosts = ['ssl.gstatic.com', 'www.gstatic.com'];

const icons = new TtlCache<SiteIcon | null>(iconTtl * 1000, 500);

function allowed(target: string): boolean {
	if (validDocumentationUrl(target)) return true;

	try {
		const url = new URL(target);
		return url.protocol === 'https:' && iconHosts.includes(url.hostname);
	} catch {
		return false;
	}
}

async function get(target: string): Promise<Response | null> {
	let next = target;

	for (let hop = 0; hop < maxHops; hop++) {
		if (!allowed(next)) return null;

		const response = await fetch(next, {
			headers: { accept: '*/*' },
			redirect: 'manual',
			signal: AbortSignal.timeout(timeout)
		});

		const location = response.headers.get('location');
		if (response.status < 300 || response.status > 399 || !location) {
			return response.ok ? response : null;
		}

		await response.body?.cancel();
		next = new URL(location, next).toString();
	}

	return null;
}

async function read(response: Response): Promise<Uint8Array<ArrayBuffer> | null> {
	if (Number(response.headers.get('content-length') ?? 0) > maxBytes) return null;
	if (!response.body) return null;

	const chunks: Uint8Array[] = [];
	let size = 0;

	for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
		size += chunk.length;
		if (size > maxBytes) {
			await response.body.cancel();
			return null;
		}
		chunks.push(chunk);
	}

	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}

	return bytes;
}

function candidates(html: string, origin: string): string[] {
	const found: { href: string; size: number }[] = [];

	for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
		const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? '';
		if (!/(^|\s)(shortcut\s+)?icon(\s|$)|apple-touch-icon/.test(rel)) continue;

		const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
		if (!href) continue;

		try {
			found.push({
				href: new URL(href, origin).toString(),
				size: Number(/\b(\d+)x\d+\b/.exec(tag)?.[1] ?? 0)
			});
		} catch {
			continue;
		}
	}

	found.sort((a, b) => b.size - a.size);
	return [...found.map((entry) => entry.href), new URL('/favicon.ico', origin).toString()];
}

async function fetchIcon(origin: string): Promise<SiteIcon | null> {
	const page = await get(origin);
	const html = page ? await read(page) : null;

	for (const candidate of candidates(html ? new TextDecoder().decode(html) : '', origin).slice(
		0,
		4
	)) {
		const response = await get(candidate);
		if (!response) continue;

		const type = (response.headers.get('content-type') ?? '').split(';')[0].trim();
		if (!type.startsWith('image/')) {
			await response.body?.cancel();
			continue;
		}

		const bytes = await read(response);
		if (bytes?.length) return { type, body: bytes };
	}

	return null;
}

export async function getIcon(documentationUrl: string): Promise<SiteIcon | null> {
	if (!validDocumentationUrl(documentationUrl)) return null;

	const origin = new URL(documentationUrl).origin;
	const cached = icons.get(origin);
	if (cached !== undefined) return cached;

	return icons.dedupe(origin, async () => {
		const icon = await fetchIcon(origin).catch(() => null);
		icons.set(origin, icon, icon ? undefined : missTtl);
		return icon;
	});
}
