import { avatarUrl, getProfile } from '$lib/server/discord';
import type { PageServerLoad } from './$types';

const roster: { role: string; ids: string[] }[] = [
	{ role: 'ERM Team', ids: ['803488329307258921', '824694141728063508'] },
	{ role: 'Managers', ids: ['707064490826530888', '730375236197023785'] },
	{ role: 'Senior Support', ids: ['902176548109582386'] },
	{
		role: 'Support',
		ids: ['1120159972500721786', '1223557591624318987', '1400691464224374795']
	}
];

export const load: PageServerLoad = async () => {
	const groups = await Promise.all(
		roster.map(async (group) => ({
			role: group.role,
			members: await Promise.all(
				group.ids.map(async (id) => {
					const profile = await getProfile(id);
					return {
						id,
						username: profile?.username || id,
						avatarUrl: profile?.avatarUrl || avatarUrl(id, '')
					};
				})
			)
		}))
	);

	return { groups };
};
