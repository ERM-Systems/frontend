import { json } from '@sveltejs/kit';
import { authorizeStrict } from '$lib/server/dashboard';
import { getUserInfractions, searchMembers } from '$lib/server/staff';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { token, guild } = await authorizeStrict(event);

	const userId = event.url.searchParams.get('userId') ?? '';
	if (userId) {
		if (!/^\d{15,25}$/.test(userId)) return json({ counts: {} });

		const infractions = await getUserInfractions(token, guild.id, userId);
		const counts: Record<string, number> = {};

		for (const entry of infractions ?? []) {
			if (entry.revoked || !entry.type) continue;
			counts[entry.type] = (counts[entry.type] ?? 0) + 1;
		}

		return json({ counts });
	}

	const query = (event.url.searchParams.get('query') ?? '').trim().slice(0, 100);
	if (query.length < 2) return json({ members: [] });

	return json({ members: (await searchMembers(token, guild.id, query)) ?? [] });
};
