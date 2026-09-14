import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import {
	clearSessionCookie,
	isRevoked,
	getSession,
	safeReturnTo,
	sessionCookie,
	sessionCookieScopes
} from '$lib/server/session';

const guardedPaths = ['/guilds', '/settings', '/billing'];
const guardedGuildRoutes = /^\/\d{17,20}\/(dashboard|panel)(\/|$)/;

const summary = `# ERM Systems

ERM gives roleplay communities the tools to manage staff, sessions, moderations, shifts, logs, and server activity from one clean dashboard.

## Pages

- /features lists what the bot does.
- /guilds lists the servers you can manage.
- /status reports live service health.
- /{guildID}/server is a public live view of a linked ER:LC server.

## Documentation

https://docs.ermbot.xyz
`;

const analytics =
	env.UMAMI_SCRIPT_URL && env.UMAMI_WEBSITE_ID
		? `<script defer src="${env.UMAMI_SCRIPT_URL}" data-website-id="${env.UMAMI_WEBSITE_ID}" data-auto-pageview="false" data-performance="true"></script>`
		: '';

const legacyPaths: Record<string, string> = {
	'/dashboard': '/features/dashboard',
	'/modpanel': '/features/moderator-panel',
	'/copilot': '/features/copilot',
	'/speech': '/features/copilot',
	'/application': '/features/applications',
	'/themes': '/discontinued',
	'/pricing': '/',
	'/payment': '/billing',
	'/payment/callback': '/billing',
	'/staff-docs': 'https://docs.ermbot.xyz'
};

function legacyTarget(pathname: string): string {
	const path = pathname.replace(/\/+$/, '') || '/';
	if (legacyPaths[path]) return legacyPaths[path];

	return path.startsWith('/themes/') ? '/discontinued' : '';
}
function guarded(pathname: string): boolean {
	return guardedPaths.includes(pathname) || guardedGuildRoutes.test(pathname);
}

const handleHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	const html = response.headers.get('content-type')?.includes('text/html');
	if (html && !response.headers.has('cache-control')) {
		response.headers.set('Cache-Control', 'private, no-store, must-revalidate');
		response.headers.set('Vary', 'Cookie');
	}

	return response;
};

const handleLegacy: Handle = ({ event, resolve }) => {
	const target = legacyTarget(event.url.pathname);
	if (target) redirect(301, target);

	return resolve(event);
};
const handleAuth: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(sessionCookie) ?? null;

	if (token && isRevoked(token)) {
		clearSessionCookie(event.cookies, event.url);
		event.locals.token = null;
		event.locals.terminated = false;
		event.locals.session = Promise.resolve(null);

		return resolve(event);
	}

	event.locals.token = token;
	event.locals.terminated = false;
	event.locals.session = token
		? getSession(token)
				.then((session) => {
					if (session === 'invalid') {
						event.locals.token = null;
						return null;
					}

					if (session === 'terminated') {
						event.locals.terminated = true;
						return null;
					}

					return session;
				})
				.catch(() => null)
		: Promise.resolve(null);

	const response = await resolve(event);

	if (token && isRevoked(token)) {
		for (const scope of sessionCookieScopes(event.url)) {
			response.headers.append(
				'set-cookie',
				event.cookies.serialize(sessionCookie, '', { ...scope, maxAge: 0 })
			);
		}
	}

	return response;
};

const handleGuard: Handle = async ({ event, resolve }) => {
	if (!event.locals.token && guarded(event.url.pathname)) {
		redirect(303, `/login?returnTo=${encodeURIComponent(event.url.pathname)}`);
	}

	if (event.locals.token && guarded(event.url.pathname)) {
		await event.locals.session;

		if (event.locals.terminated) redirect(303, '/terminated');

		if (isRevoked(event.locals.token)) {
			clearSessionCookie(event.cookies, event.url);
			event.locals.token = null;
			event.locals.session = Promise.resolve(null);

			redirect(303, `/login?returnTo=${encodeURIComponent(event.url.pathname)}`);
		}
	}

	if (event.locals.token && event.url.pathname === '/login') {
		if (await event.locals.session) {
			redirect(303, safeReturnTo(event.url.searchParams.get('returnTo')));
		}
	}

	return resolve(event);
};

const handleSummary: Handle = ({ event, resolve }) => {
	if (
		event.url.pathname === '/' &&
		event.request.headers.get('accept')?.includes('text/markdown')
	) {
		return Promise.resolve(
			new Response(summary, {
				headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
			})
		);
	}

	return resolve(event);
};

const handleAnalytics: Handle = ({ event, resolve }) =>
	resolve(event, { transformPageChunk: ({ html }) => html.replace('%analytics%', analytics) });

export const handle: Handle = sequence(
	handleHeaders,
	handleLegacy,
	handleAuth,
	handleGuard,
	handleSummary,
	handleAnalytics
);
