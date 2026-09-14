import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) =>
	redirect(301, `/${params.guildID}/apply/${params.uuid}`);
