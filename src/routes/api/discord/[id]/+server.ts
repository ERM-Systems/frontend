import { error, json } from '@sveltejs/kit';
import { getProfile, profileTtl } from '$lib/server/discord';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, setHeaders }) => {
	if (!/^\d{17,20}$/.test(params.id)) error(400, 'invalid discord id passed');

	const profile = await getProfile(params.id);
	if (!profile) error(404, 'failed to fetch profile info');

	setHeaders({ 'cache-control': `public, max-age=${profileTtl}` });
	return json(profile);
};
