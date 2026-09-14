import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export interface RobloxUser {
	username: string;
	avatarUrl: string;
}

async function lookup(fetcher: typeof fetch, username: string): Promise<RobloxUser | null> {
	if (!env.VITE_INTERNAL_URL) return null;

	try {
		const response = await fetcher(
			`${env.VITE_INTERNAL_URL}/Roblox/User/Username/${encodeURIComponent(username)}`,
			{ signal: AbortSignal.timeout(10000) }
		);
		if (!response.ok) return null;

		const body = (await response.json()) as { Username?: string; AvatarURL?: string };
		if (!body.Username) return null;

		return { username: body.Username, avatarUrl: String(body.AvatarURL ?? '') };
	} catch {
		return null;
	}
}

export const load: PageServerLoad = ({ fetch, url }) => {
	const username = url.searchParams.get('username') ?? '';

	return {
		username,
		error: url.searchParams.get('error') ?? '',
		state: url.searchParams.get('state') ?? '',
		panel: url.searchParams.get('panel') === 'true',
		staging: env.ENVIRONMENT === 'staging',
		affiliates: env.ENVIRONMENT === 'affiliates',
		roblox: username ? lookup(fetch, username) : null
	};
};
