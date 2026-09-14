import {
	assertSitemapEnabled,
	getOverviewGuilds,
	serverSitemapCount,
	sitemapIndex
} from '$lib/server/sitemap';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	assertSitemapEnabled();

	const guilds = await getOverviewGuilds();

	return sitemapIndex(url.origin, [
		'/sitemap/public.xml',
		...Array.from(
			{ length: serverSitemapCount(guilds.length) },
			(_, index) => `/sitemap/servers-${index + 1}.xml`
		)
	]);
};
