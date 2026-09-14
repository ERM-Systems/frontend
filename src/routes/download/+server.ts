import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	redirect(302, 'https://github.com/1FriendlyDoge/Desktop-Releases/releases/tag/V1.0.3');
};
