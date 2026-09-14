import { redirect } from '@sveltejs/kit';
import { landingSlug, managementLevel } from '$lib/dashboard';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
	const { access, setupPending } = await parent();
	const { level, reviewer } = await access;

	if (setupPending && level >= managementLevel) {
		redirect(307, `/${params.guildID}/dashboard/setup`);
	}

	redirect(307, `/${params.guildID}/dashboard/${landingSlug({ level, reviewer })}`);
};
