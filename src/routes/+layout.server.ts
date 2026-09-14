import { avatarUrl } from '$lib/server/discord';
import { getGuilds } from '$lib/server/guilds';
import { getNotifications } from '$lib/server/notifications';
import { getStatus } from '$lib/server/status';
import type { LayoutServerLoad } from './$types';

export type { Group, Shard, State, Status } from '$lib/server/status';
export type { Notification, NotificationType } from '$lib/server/notifications';

export const load: LayoutServerLoad = async ({ depends, fetch, locals, route }) => {
	depends('app:status');
	depends('app:notifications');

	const token = locals.token;
	if (token) void getGuilds(token);

	const user = locals.session.then(
		(session) =>
			session && {
				id: session.discordId,
				username: session.username,
				avatarUrl: avatarUrl(session.discordId, session.avatar)
			}
	);

	const notifications = token ? getNotifications(token) : null;
	const status = getStatus(fetch);
	const signedIn = !!token;

	if (!route.id) {
		return {
			signedIn,
			user: await user,
			notifications: await notifications,
			status: await status
		};
	}

	return { signedIn, user, notifications, status };
};
