import { error, json } from '@sveltejs/kit';
import { clear, markRead } from '$lib/server/notifications';
import { sessionCookie } from '$lib/server/session';
import type { RequestHandler } from './$types';

const key = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^\d{1,20}$/i;

function target(url: URL): string | null {
	const value = url.searchParams.get('id');
	if (value === null) return null;
	if (!key.test(value)) error(400, 'invalid notification passed');

	return value;
}

export const PUT: RequestHandler = async ({ cookies, url }) => {
	const token = cookies.get(sessionCookie);
	if (!token) error(401, 'not signed in');

	if (!(await markRead(token, target(url)))) error(502, 'failed to mark as read');

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const token = cookies.get(sessionCookie);
	if (!token) error(401, 'not signed in');

	if (!(await clear(token, target(url)))) error(502, 'failed to clear notifications');

	return json({ ok: true });
};
