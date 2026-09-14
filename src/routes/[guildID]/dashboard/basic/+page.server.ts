import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import {
	basicSettings,
	createDocumentation,
	deleteDocumentation,
	editDocumentation,
	getDocumentation,
	getSettings,
	payload,
	saveSettings
} from '$lib/server/settings';
import {
	prefixes,
	punishmentLevels,
	validDocumentationName,
	validDocumentationUrl,
	type BasicSettings
} from '$lib/settings';
import type { Actions, PageServerLoad } from './$types';

export type { BasicSettings, DocumentationType } from '$lib/settings';

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const raw = await getSettings(token, guild.id);
	if (!raw) error(502, 'Your server settings are unavailable right now, try again shortly.');

	return {
		settings: basicSettings(raw),
		documentation: getDocumentation(token, guild.id),
		supportPin: String(raw.support_pin ?? '')
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });
		if (!prefixes.includes(String(body.prefix))) {
			return fail(400, { message: 'That prefix is not allowed.' });
		}

		const settings = basicSettings({
			erm_log_channel: body.logChannel,
			customisation: { prefix: body.prefix },
			staff_management: {
				role: body.staffRoles,
				management_role: body.managementRoles,
				admin_role: body.adminRoles
			}
		}) as BasicSettings;

		const message = await saveSettings(
			token,
			guild.id,
			{
				erm_log_channel: settings.logChannel,
				customisation: { prefix: settings.prefix },
				staff_management: {
					role: settings.staffRoles,
					management_role: settings.managementRoles,
					admin_role: settings.adminRoles
				}
			},
			'basic'
		);
		if (message) return fail(502, { message });

		return { settings };
	},

	supportPin: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const supportPin = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));

		const message = await saveSettings(token, guild.id, { support_pin: supportPin }, 'basic');
		if (message) return fail(502, { message });

		return { supportPin };
	},

	documentation: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;
		const form = await event.request.formData();

		const id = String(form.get('id') ?? '');
		const name = String(form.get('name') ?? '').trim();
		const url = String(form.get('url') ?? '').trim();
		const punishmentLevel = Number(form.get('punishmentLevel') ?? 0);

		if (!validDocumentationName(name)) {
			return fail(400, { message: 'The name must be between 3 and 50 characters.' });
		}
		if (!validDocumentationUrl(url)) {
			return fail(400, {
				message: 'The link must be a Google services, GitBook or Mintlify HTTPS link.'
			});
		}
		if (!punishmentLevels.some((level) => level.value === punishmentLevel)) {
			return fail(400, { message: 'Pick who this documentation applies to.' });
		}

		if (!id) {
			const created = await createDocumentation(token, guild.id, { name, url, punishmentLevel });
			if (typeof created === 'string') return fail(502, { message: created });

			return { documentation: created };
		}

		const entry = { id, name, url, punishmentLevel };
		const message = await editDocumentation(token, guild.id, entry);
		if (message) return fail(502, { message });

		return { documentation: entry };
	},

	removeDocumentation: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const id = String((await event.request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Unknown documentation type.' });

		const message = await deleteDocumentation(token, guild.id, id);
		if (message) return fail(502, { message });

		return { removed: id };
	}
};
