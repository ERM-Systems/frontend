import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import {
	bool,
	deletePunishmentType,
	getPunishmentTypes,
	getSettings,
	group,
	id,
	payload,
	saveSettings,
	savePunishmentType,
	text
} from '$lib/server/settings';
import {
	deletePunishmentPreset,
	getPunishmentPresets,
	savePunishmentPreset
} from '$lib/server/staff';
import { defaultPunishmentTypes, punishmentPermissions, type PunishmentType } from '$lib/settings';
import type { Actions, PageServerLoad } from './$types';

export type { PunishmentType } from '$lib/settings';
export type { PunishmentPreset } from '$lib/server/staff';

export interface EditableType extends PunishmentType {
	remove?: boolean;
}

export interface PunishmentSettings {
	enabled: boolean;
	channel: string;
	kick_channel: string;
	ban_channel: string;
	bolo_channel: string;
}

function read(raw: Record<string, unknown>): PunishmentSettings {
	const punishments = group(raw, 'punishments');

	return {
		enabled: bool(punishments.enabled),
		channel: id(punishments.channel),
		kick_channel: id(punishments.kick_channel),
		ban_channel: id(punishments.ban_channel),
		bolo_channel: id(punishments.bolo_channel)
	};
}

function custom(list: PunishmentType[]): EditableType[] {
	return list.filter((entry) => !defaultPunishmentTypes.includes(entry.name));
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const [raw, types, presets] = await Promise.all([
		getSettings(token, guild.id),
		getPunishmentTypes(token, guild.id),
		getPunishmentPresets(token, guild.id)
	]);
	if (!raw || !types) {
		error(502, 'Your server settings are unavailable right now, try again shortly.');
	}

	return {
		settings: { ...read(raw), types: custom(types) },
		presets: presets ?? []
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those settings.' });

		const incoming = (Array.isArray(body.types) ? (body.types as Record<string, unknown>[]) : [])
			.filter((entry) => entry.remove !== true)
			.map((entry) => ({
				id: text(entry.id),
				name: text(entry.name).trim(),
				channel: id(entry.channel)
			}));

		const seen = new Set<string>();
		for (const entry of incoming) {
			if (entry.name.length < 2 || entry.name.length > 32) {
				return fail(400, { message: 'Type names must be between 2 and 32 characters.' });
			}
			if (defaultPunishmentTypes.includes(entry.name)) {
				return fail(400, { message: `${entry.name} already exists as a built-in type.` });
			}
			if (seen.has(entry.name.toLowerCase())) {
				return fail(400, { message: `You already have a type called ${entry.name}.` });
			}
			seen.add(entry.name.toLowerCase());
		}

		const existing = await getPunishmentTypes(token, guild.id);
		if (!existing) return fail(502, { message: 'Could not load your punishment types.' });

		const settings = read({ punishments: body });

		const message = await saveSettings(token, guild.id, { punishments: settings }, 'punishments');
		if (message) return fail(502, { message });

		const kept = new Set(incoming.map((entry) => entry.id).filter(Boolean));
		for (const entry of custom(existing)) {
			if (kept.has(entry.id)) continue;

			const failure = await deletePunishmentType(token, guild.id, entry.id);
			if (failure) return fail(502, { message: failure });
		}

		for (const entry of incoming) {
			const before = existing.find((item) => item.id === entry.id);
			if (before && before.name === entry.name && before.channel === entry.channel) continue;

			const failure = await savePunishmentType(token, guild.id, {
				id: entry.id,
				name: entry.name,
				channel: entry.channel
			});
			if (failure) return fail(502, { message: failure });
		}

		const types = await getPunishmentTypes(token, guild.id);

		return { settings: { ...settings, types: custom(types ?? incoming) } };
	},

	savePreset: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const result = form.get('result')?.toString().trim() ?? '';
		const type = form.get('type')?.toString().trim() ?? '';
		const permissionLevel = Number(form.get('permissionLevel'));
		const oldName = form.get('oldName')?.toString().trim() ?? '';

		if (name.length < 2 || name.length > 32) {
			return fail(400, { message: 'Preset names must be between 2 and 32 characters.' });
		}
		if (result.length < 2 || result.length > 500) {
			return fail(400, { message: 'Give a result between 2 and 500 characters.' });
		}
		if (!type) return fail(400, { message: 'Pick a punishment type for this preset.' });
		if (!punishmentPermissions.some((level) => level.value === permissionLevel)) {
			return fail(400, { message: 'Pick a permission level for this preset.' });
		}

		const message = await savePunishmentPreset(
			token,
			guild.id,
			{ name, result, type, permissionLevel },
			oldName
		);
		if (message) return fail(502, { message });

		return { saved: true };
	},

	deletePreset: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const form = await event.request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		if (!name) return fail(400, { message: 'Pick a preset to delete.' });

		const message = await deletePunishmentPreset(token, guild.id, name);
		if (message) return fail(502, { message });

		return { removed: true };
	}
};
