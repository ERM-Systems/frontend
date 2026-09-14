import { redirect } from '@sveltejs/kit';
import { afterLogin } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	if (url.searchParams.has('error')) redirect(303, '/');

	const guild = url.searchParams.get('guild_id') ?? '';
	const target = new URL(afterLogin, url.origin);
	if (/^\d{17,20}$/.test(guild)) target.searchParams.set('guild', guild);

	for (const [key, value] of new URLSearchParams(url.searchParams.get('state') ?? '')) {
		if (key.startsWith('utm_')) target.searchParams.set(key, value);
	}

	redirect(303, `${target.pathname}${target.search}`);
};
