import { redirect } from '@sveltejs/kit';
import {
	clearSessionCookie,
	getSession,
	returnCookie,
	safeReturnTo,
	sessionCookie,
	sessionMaxAge
} from '$lib/server/session';
import type { RequestHandler } from './$types';

function withNotice(path: string, origin: string): string {
	const target = new URL(path, origin);
	target.searchParams.set('login', 'success');
	return `${target.pathname}${target.search}`;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const token = url.searchParams.get('token') ?? '';
	const returnTo = safeReturnTo(cookies.get(returnCookie));
	cookies.delete(returnCookie, { path: '/' });

	if (!token) redirect(303, '/?error=login');

	if ((await getSession(token)) === 'invalid') redirect(303, '/?error=login');

	clearSessionCookie(cookies, url);
	cookies.set(sessionCookie, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: sessionMaxAge
	});

	redirect(303, withNotice(returnTo, url.origin));
};
