import { redirect } from '@sveltejs/kit';
import { revokeSession, sessionCookie } from '$lib/server/session';
import { endSession } from '$lib/server/user';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(sessionCookie);
	if (token) {
		await endSession(token);
		revokeSession(token);
	}

	cookies.delete(sessionCookie, { path: '/' });
	redirect(303, '/?logout=success');
};
