export interface PermissionEntry {
	key: string;
	label: string;
	description: string;
	level: number;
}

export interface PermissionGroup {
	key: string;
	label: string;
	permissions: PermissionEntry[];
}

export interface PermissionRole {
	id: string;
	name: string;
	color: string;
	discord_role_ids: string[];
	permissions: Record<string, boolean>;
}

export interface GuildPermissions {
	mode: string;
	roles: PermissionRole[];
}

export const maxPermissionRoles = 25;
export const maxRoleNameLength = 50;

export function blankPermissionRole(name: string): PermissionRole {
	return {
		id: '',
		name,
		color: '',
		discord_role_ids: [],
		permissions: {}
	};
}

export function grantedCount(role: PermissionRole): number {
	return Object.values(role.permissions).filter(Boolean).length;
}

export function groupGranted(role: PermissionRole, group: PermissionGroup): number {
	return group.permissions.filter((entry) => role.permissions[entry.key]).length;
}

export function setGroup(role: PermissionRole, group: PermissionGroup, granted: boolean) {
	const next = { ...role.permissions };

	for (const entry of group.permissions) {
		if (granted) next[entry.key] = true;
		else delete next[entry.key];
	}

	role.permissions = next;
}

export function toggle(role: PermissionRole, key: string, granted: boolean) {
	const next = { ...role.permissions };

	if (granted) next[key] = true;
	else delete next[key];

	role.permissions = next;
}

export function roleSummary(role: PermissionRole, groups: PermissionGroup[]): string {
	const total = grantedCount(role);
	if (!total) return 'No permissions yet';

	const covered = groups
		.filter((group) => groupGranted(role, group) > 0)
		.map((group) => group.label);

	const shown = covered.slice(0, 3).join(', ');
	const extra = covered.length > 3 ? ` +${covered.length - 3} more` : '';

	return `${total} permission${total === 1 ? '' : 's'} across ${shown}${extra}`;
}

export const managementLevel = 3;

export const enforcedPanelActions = new Set([
	'shift.start',
	'shift.end',
	'shift.break',
	'shift.forceEnd',
	'shift.void',
	'moderation.create',
	'moderation.update',
	'moderation.delete',
	'moderation.complete',
	'priority.update',
	'request.ack',
	'request.ackAll',
	'assistance.request'
]);

export function panelPermissionKey(action: string, playerCommand: string): string {
	if (action === 'player') {
		return playerCommand ? `panel.player.${playerCommand}` : '';
	}
	return enforcedPanelActions.has(action) ? `panel.${action}` : '';
}
