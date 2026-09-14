import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { features } from '$lib/features';
import { TtlCache } from './cache';

export interface SitemapEntry {
	path: string;
	changefreq: string;
	priority: string;
}

export const serversPerSitemap = 1000;

export function assertSitemapEnabled() {
	if (env.ENVIRONMENT === 'affiliates') error(404, 'Not found.');
}

const ttl = 60 * 60_000;
const timeout = 30_000;
const key = 'overviewGuilds';
const cache = new TtlCache<string[]>(ttl);

const cooldown = 60_000;
let downUntil = 0;

export const publicEntries: SitemapEntry[] = [
	{ path: '/', changefreq: 'weekly', priority: '1.0' },
	{ path: '/features', changefreq: 'weekly', priority: '0.9' },
	...features.map((feature) => ({
		path: `/features/${feature.slug}`,
		changefreq: 'monthly',
		priority: '0.8'
	})),
	{ path: '/status', changefreq: 'daily', priority: '0.7' },
	{ path: '/guilds', changefreq: 'weekly', priority: '0.6' },
	{ path: '/team', changefreq: 'monthly', priority: '0.5' },
	{ path: '/login', changefreq: 'monthly', priority: '0.5' },
	{ path: '/invite', changefreq: 'monthly', priority: '0.5' },
	{ path: '/terms', changefreq: 'yearly', priority: '0.3' },
	{ path: '/privacy', changefreq: 'yearly', priority: '0.3' }
];

export async function getOverviewGuilds(): Promise<string[]> {
	const cached = cache.get(key);
	if (cached) return cached;

	const refresh = cache.dedupe(key, async () => {
		if (!env.VITE_INTERNAL_URL || Date.now() < downUntil) return cache.stale(key) ?? [];

		try {
			const response = await fetch(`${env.VITE_INTERNAL_URL}/Overview/PublicGuilds`, {
				signal: AbortSignal.timeout(timeout)
			});
			if (!response.ok) {
				downUntil = Date.now() + cooldown;
				return cache.stale(key) ?? [];
			}

			const body = (await response.json()) as { guilds?: unknown };
			const guilds = (Array.isArray(body.guilds) ? body.guilds : [])
				.map((guild) => String(guild))
				.filter((guild) => /^\d{17,20}$/.test(guild));

			cache.set(key, guilds);
			return guilds;
		} catch (error) {
			downUntil = Date.now() + cooldown;
			console.warn('/Overview/PublicGuilds failed:', error);
			return cache.stale(key) ?? [];
		}
	});

	return cache.stale(key) ?? refresh;
}

export function serverSitemapCount(total: number): number {
	return Math.ceil(total / serversPerSitemap);
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function xml(body: string): Response {
	return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
}

export function sitemapIndex(origin: string, paths: string[]): Response {
	const lastmod = today();
	const body = paths
		.map(
			(path) =>
				`\t<sitemap>\n\t\t<loc>${origin}${path}</loc>\n\t\t<lastmod>${lastmod}</lastmod>\n\t</sitemap>`
		)
		.join('\n');

	return xml(
		`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`
	);
}

export function urlSet(origin: string, entries: SitemapEntry[]): Response {
	const lastmod = today();
	const body = entries
		.map(
			(entry) =>
				`\t<url>\n\t\t<loc>${origin}${entry.path}</loc>\n\t\t<lastmod>${lastmod}</lastmod>\n\t\t<changefreq>${entry.changefreq}</changefreq>\n\t\t<priority>${entry.priority}</priority>\n\t</url>`
		)
		.join('\n');

	return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`);
}
