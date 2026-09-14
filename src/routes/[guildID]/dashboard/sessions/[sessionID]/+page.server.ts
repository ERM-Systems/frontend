import { error } from '@sveltejs/kit';
import { authorizeStrict } from '$lib/server/dashboard';
import { getProfile, type DiscordProfile } from '$lib/server/discord';
import { getSessionHistory } from '$lib/server/sessions';
import { getShifts, type ShiftRecord } from '$lib/server/staff';
import type { SessionHistoryEntry } from '$lib/sessions';
import type { PageServerLoad } from './$types';

async function shiftsDuring(
	token: string,
	guildId: string,
	session: SessionHistoryEntry
): Promise<ShiftRecord[]> {
	const shifts = (await getShifts(token, guildId)) ?? [];

	return shifts
		.filter((shift) => {
			const end = shift.end || session.endedAt;
			return shift.start <= session.endedAt && end >= session.startedAt;
		})
		.sort((a, b) => b.duration - a.duration);
}

async function profilesFor(ids: string[]): Promise<Record<string, DiscordProfile | null>> {
	const resolved = await Promise.all(
		ids.map(async (id) => [id, await getProfile(id).catch(() => null)] as const)
	);

	return Object.fromEntries(resolved);
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeStrict(event);

	const history = await getSessionHistory(token, guild.id);
	const session = history.find((entry) => entry.id === event.params.sessionID);
	if (!session) error(404, 'That session is not in your history.');

	const ids = [...new Set([session.startedBy, session.endedBy, ...session.votedUsers])].filter(
		Boolean
	);

	return {
		session,
		shifts: shiftsDuring(token, guild.id, session).catch(() => [] as ShiftRecord[]),
		profiles: profilesFor(ids).catch(() => ({}) as Record<string, DiscordProfile | null>)
	};
};
