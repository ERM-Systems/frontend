import { error } from '@sveltejs/kit';
import { findFeature } from '$lib/features';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	if (!findFeature(params.slug)) error(404, 'That feature does not exist.');

	return { slug: params.slug };
};
