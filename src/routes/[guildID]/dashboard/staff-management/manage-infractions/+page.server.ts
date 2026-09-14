import { error, fail } from '@sveltejs/kit';
import { packMessage } from '$lib/discord';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import { getSettings, payload, readInfractions, saveSettings } from '$lib/server/settings';
import type { InfractionNotification, InfractionType } from '$lib/settings';
import type { Actions, PageServerLoad } from './$types';

function packNotification(notification: InfractionNotification): Record<string, unknown> {
	const packed = packMessage(notification.message);
	const embeds = Array.isArray(packed.embeds) ? (packed.embeds as Record<string, unknown>[]) : [];

	return {
		enabled: notification.enabled,
		channel_id: notification.channel_id,
		...packed,
		...(embeds.length ? { embed: embeds[0] } : {})
	};
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const raw = await getSettings(token, guild.id);
	if (!raw) {
		error(502, 'Your server settings are unavailable right now, try again shortly.');
	}

	return { settings: readInfractions(raw) };
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const value = readInfractions({ infractions: { infractions: body.infractions } });

		const cleaned: InfractionType[] = value.infractions.map((entry) => ({
			...entry,
			name: entry.name.trim(),
			escalation: {
				...entry.escalation,
				next_infraction: entry.escalation.next_infraction.trim()
			}
		}));

		const seen = new Set<string>();
		for (const entry of cleaned) {
			if (entry.name.length < 2 || entry.name.length > 32) {
				return fail(400, { message: 'Infraction names must be between 2 and 32 characters.' });
			}
			if (seen.has(entry.name.toLowerCase())) {
				return fail(400, { message: `You already have an infraction called ${entry.name}.` });
			}
			seen.add(entry.name.toLowerCase());
		}

		const names = new Set(cleaned.map((entry) => entry.name.toLowerCase()));
		for (const entry of cleaned) {
			const next = entry.escalation.next_infraction;
			if (next && !names.has(next.toLowerCase())) {
				return fail(400, {
					message: `${entry.name} escalates to ${next}, which no longer exists.`
				});
			}
		}

		const persisted = cleaned.map((entry) => ({
			...entry,
			notifications: {
				dm: packNotification(entry.notifications.dm),
				public: packNotification(entry.notifications.public)
			}
		}));

		const message = await saveSettings(token, guild.id, {
			infractions: { infractions: persisted }
		});
		if (message) return fail(502, { message });

		return { settings: { infractions: cleaned } };
	}
};
