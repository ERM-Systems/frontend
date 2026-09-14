import { fail } from '@sveltejs/kit';
import { authorizeAction, authorizeStrict } from '$lib/server/dashboard';
import { loadBans, loadServer, runMassUnban } from '$lib/server/panel';
import { requireUser } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export type { BannedPlayer } from '$lib/server/panel';

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeStrict(event);

	const [bans, server] = await Promise.all([
		loadBans(token, guild.id),
		loadServer(token, guild.id)
	]);

	return {
		players: bans.players,
		wait: bans.wait,
		server: {
			status: server.status,
			message: server.message,
			currentPlayers: server.currentPlayers
		}
	};
};

export const actions: Actions = {
	unban: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const user = await requireUser(event.locals, event.url);

		const ids = String((await event.request.formData()).get('ids') ?? '')
			.split(',')
			.map((id) => id.trim())
			.filter((id) => /^\d{1,20}$/.test(id));

		const result = await runMassUnban({ token, guildId: guild.id, username: user.username }, ids);
		if (!result.ok) return fail(400, { message: result.message });

		return { message: result.message };
	}
};
