import { error, fail } from '@sveltejs/kit';
import { authorizeAction, authorizeGuild } from '$lib/server/dashboard';
import {
	getGuildPermissions,
	getPermissionCatalogue,
	getSettings,
	group,
	ids,
	payload,
	saveGuildPermissions,
	saveSettings
} from '$lib/server/settings';
import { maxPermissionRoles, maxRoleNameLength } from '$lib/permissions';
import type { PermissionGroup, PermissionRole } from '$lib/permissions';
import type { Actions, PageServerLoad } from './$types';

function readRole(raw: Record<string, unknown>, known: Set<string>): PermissionRole {
	const permissions: Record<string, boolean> = {};
	const stored = raw.permissions;

	if (stored && typeof stored === 'object') {
		for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
			if (value === true && known.has(key)) permissions[key] = true;
		}
	}

	const roleIds = Array.isArray(raw.discord_role_ids) ? raw.discord_role_ids : [];

	return {
		id: String(raw.id ?? ''),
		name: String(raw.name ?? '').slice(0, maxRoleNameLength),
		color: String(raw.color ?? ''),
		discord_role_ids: roleIds
			.map((entry) => String(entry))
			.filter((entry) => /^\d{17,20}$/.test(entry)),
		permissions
	};
}

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const [groups, permissions, raw] = await Promise.all([
		getPermissionCatalogue(token, guild.id),
		getGuildPermissions(token, guild.id),
		getSettings(token, guild.id)
	]);

	if (!groups || !permissions || !raw) {
		error(502, 'Your permission settings are unavailable right now, try again shortly.');
	}

	const staff = group(raw, 'staff_management');

	const known = new Set(
		(groups as PermissionGroup[]).flatMap((group) => group.permissions.map((entry) => entry.key))
	);

	return {
		groups: groups as PermissionGroup[],
		roles: (permissions.roles as Record<string, unknown>[]).map((role) => readRole(role, known)),
		levels: {
			staffRoles: ids(staff.role),
			adminRoles: ids(staff.admin_role),
			managementRoles: ids(staff.management_role)
		}
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { token, guild, limited } = await authorizeAction(event);
		if (limited) return limited;

		const body = payload(await event.request.formData());
		if (!body) return fail(400, { message: 'Could not read those permissions.' });

		const groups = await getPermissionCatalogue(token, guild.id);
		if (!groups) return fail(502, { message: 'Could not load the permission list.' });

		const known = new Set(
			(groups as PermissionGroup[]).flatMap((group) => group.permissions.map((e) => e.key))
		);

		const incoming = Array.isArray(body.roles) ? (body.roles as Record<string, unknown>[]) : [];
		if (incoming.length > maxPermissionRoles) {
			return fail(400, { message: `You can have at most ${maxPermissionRoles} roles.` });
		}

		const roles = incoming.map((role) => readRole(role, known));

		const unnamed = roles.find((role) => !role.name.trim());
		if (unnamed) return fail(400, { message: 'Every role needs a name.' });

		const levels = {
			staffRoles: ids((body.levels as Record<string, unknown>)?.staffRoles),
			adminRoles: ids((body.levels as Record<string, unknown>)?.adminRoles),
			managementRoles: ids((body.levels as Record<string, unknown>)?.managementRoles)
		};

		if (!levels.managementRoles.length) {
			return fail(400, {
				message: 'Pick at least one management role, otherwise nobody can open this dashboard.'
			});
		}

		const settingsMessage = await saveSettings(token, guild.id, {
			staff_management: {
				role: levels.staffRoles,
				admin_role: levels.adminRoles,
				management_role: levels.managementRoles
			}
		});
		if (settingsMessage) return fail(502, { message: settingsMessage });

		const message = await saveGuildPermissions(token, guild.id, roles);
		if (message) return fail(502, { message });

		return { roles, levels };
	}
};
