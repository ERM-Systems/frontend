import { error } from '@sveltejs/kit';
import {
	assertSitemapEnabled,
	getOverviewGuilds,
	serverSitemapCount,
	serversPerSitemap,
	urlSet
} from '$lib/server/sitemap';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	assertSitemapEnabled();

	const guilds = await getOverviewGuilds();
	const page = Number(params.page);

	if (!/^\d+$/.test(params.page) || page < 1 || page > serverSitemapCount(guilds.length)) {
		error(404, 'That sitemap does not exist.');
	}

	const entries = guilds
		.slice((page - 1) * serversPerSitemap, page * serversPerSitemap)
		.map((guild) => ({ path: `/${guild}/server`, changefreq: 'hourly', priority: '0.6' }));

	return urlSet(url.origin, entries);
};
