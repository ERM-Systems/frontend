import { redirect } from '@sveltejs/kit';
import { getAffiliateProfiles } from '$lib/server/affiliates';
import { afterLogin } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.session;

	redirect(303, session ? afterLogin : '/login');

	return { affiliates: await getAffiliateProfiles() };
};
