import { env } from '$env/dynamic/private';
import type { Affiliate } from '$lib/affiliates';
import { TtlCache } from './cache';

interface AffiliateResponse {
	Affiliates?: {
		ID?: string;
		Name?: string;
		Slogan?: string;
		Testimony?: string;
		Invite?: string;
		Logo?: string;
		Color?: string;
		Images?: string[];
	}[];
}

const hex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const key = 'affiliates';
const ttl = 5 * 60_000;
const timeout = 10_000;

const cache = new TtlCache<Affiliate[]>(ttl);

function webp(url: string): string {
	if (!url.startsWith('https://cdn.discordapp.com/')) return url;

	const file = url.split('?')[0].split('/').pop() ?? '';
	if (!file.endsWith('.png') || file.startsWith('a_')) return url;

	return url.replace('.png', '.webp');
}

async function fetchAffiliates(): Promise<Affiliate[] | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetch(`${env.VITE_INTERNAL_URL}/Users/Affiliates`, {
			signal: AbortSignal.timeout(timeout)
		});
		if (!response.ok) {
			console.warn(`/Users/Affiliates responded ${response.status}: ${await response.text()}`);
			return null;
		}

		const body = (await response.json()) as AffiliateResponse;
		const list = (body.Affiliates ?? [])
			.filter((entry) => entry?.ID)
			.map((entry) => ({
				id: String(entry.ID),
				name: String(entry.Name ?? ''),
				slogan: String(entry.Slogan ?? ''),
				testimony: String(entry.Testimony ?? ''),
				invite: String(entry.Invite ?? ''),
				logo: webp(String(entry.Logo ?? '')),
				color: hex.test(entry.Color ?? '') ? String(entry.Color) : '',
				images: (entry.Images ?? []).filter(
					(image) => typeof image === 'string' && image.length > 0
				)
			}));

		cache.set(key, list);
		return list;
	} catch (error) {
		console.warn('/Users/Affiliates failed:', error);
		return null;
	}
}

async function loadAffiliates(): Promise<Affiliate[] | null> {
	const cached = cache.get(key);
	if (cached) return cached;

	const list = await cache.dedupe(key, fetchAffiliates);
	return list ?? cache.stale(key) ?? null;
}

export async function getAffiliateProfiles(): Promise<Affiliate[]> {
	return (await loadAffiliates())?.filter((affiliate) => affiliate.name) ?? [];
}

export async function getAffiliates(): Promise<string[] | null> {
	return (await loadAffiliates())?.map((affiliate) => affiliate.id) ?? null;
}

export async function isAffiliate(guildId: string): Promise<boolean> {
	return (await getAffiliates())?.includes(guildId) ?? false;
}
