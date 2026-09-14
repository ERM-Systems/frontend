import { error, json } from '@sveltejs/kit';
import { sessionCookie } from '$lib/server/session';
import { getStats } from '$lib/server/user';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const token = cookies.get(sessionCookie);
	if (!token) error(401, 'not signed in');

	const raw = url.searchParams.get('year');
	const year = raw === null ? null : Number(raw);
	if (
		year !== null &&
		(!Number.isInteger(year) || year < 2015 || year > new Date().getFullYear())
	) {
		error(400, 'invalid year passed');
	}

	const stats = await getStats(token, year === null ? { days: 365 } : { year });
	if (!stats) error(502, 'failed to fetch statistics');

	return json(stats);
};
