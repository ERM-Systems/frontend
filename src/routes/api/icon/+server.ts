import { error } from '@sveltejs/kit';
import { getIcon, iconTtl } from '$lib/server/documentation';
import { validDocumentationUrl } from '$lib/settings';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const target = url.searchParams.get('url') ?? '';
	if (!validDocumentationUrl(target)) error(400, 'invalid documentation url passed');

	const icon = await getIcon(target);
	if (!icon) error(404, 'failed to resolve site icon');

	return new Response(icon.body, {
		headers: {
			'content-type': icon.type,
			'cache-control': `public, max-age=${iconTtl}, immutable`
		}
	});
};
