import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const clientId = '978662093408591912';
const permissions = '8';
const scope = 'bot applications.commands';

export const GET: RequestHandler = ({ url }) => {
	const authorize = new URL('https://discord.com/oauth2/authorize');
	authorize.searchParams.set('client_id', clientId);
	authorize.searchParams.set('permissions', permissions);
	authorize.searchParams.set('scope', scope);
	authorize.searchParams.set('response_type', 'code');
	authorize.searchParams.set('redirect_uri', `${url.origin}/invite/callback`);

	const tags = new URLSearchParams(
		[...url.searchParams].filter(([key]) => key.startsWith('utm_'))
	).toString();
	if (tags) authorize.searchParams.set('state', tags);

	redirect(302, authorize);
};
