import { assertSitemapEnabled, publicEntries, urlSet } from '$lib/server/sitemap';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	assertSitemapEnabled();

	return urlSet(url.origin, publicEntries);
};
