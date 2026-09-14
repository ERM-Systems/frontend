import { blankMessage, type DiscordMessage } from '$lib/discord';

export interface BasicSettings {
	logChannel: string;
	prefix: string;
	staffRoles: string[];
	managementRoles: string[];
	adminRoles: string[];
}

export interface WhitelabelSettings {
	botName: string;
	avatarUrl: string;
	bannerUrl: string;
	bio: string;
}

export interface DocumentationType {
	id: string;
	name: string;
	url: string;
	punishmentLevel: number;
	faviconURL?: string;
}

export interface PunishmentType {
	id: string;
	name: string;
	channel: string;
}

export interface InfractionRoleChange {
	temporary: boolean;
	duration: number;
	roles: string[];
}

export interface InfractionNotification {
	enabled: boolean;
	channel_id: string;
	message: DiscordMessage;
}

export interface InfractionType {
	id: number;
	name: string;
	end_shift: boolean;
	remove_ingame_perms: boolean;
	manager_roles: string[];
	escalation: { threshold: number; next_infraction: string };
	role_changes: { add: InfractionRoleChange; remove: InfractionRoleChange };
	notifications: { dm: InfractionNotification; public: InfractionNotification };
	expiry: { enabled: boolean; duration: number };
}

export interface InfractionSettings {
	infractions: InfractionType[];
}

export function blankRoleChange(): InfractionRoleChange {
	return { temporary: false, duration: 0, roles: [] };
}

export function blankNotification(): InfractionNotification {
	return { enabled: false, channel_id: '', message: blankMessage() };
}

export interface MessageVariable {
	token: string;
	description: string;
	example?: string;
}

export const infractionVariables: MessageVariable[] = [
	{ token: '{user}', description: 'Mentions the member' },
	{ token: '{user.name}', description: 'Their username' },
	{ token: '{user.id}', description: 'Their user ID' },
	{ token: '{user.tag}', description: 'Their full tag' },
	{ token: '{type}', description: 'Infraction type' },
	{ token: '{reason}', description: 'Reason given', example: 'Failed to attend training' },
	{ token: '{notes}', description: 'Notes, or N/A', example: 'Second offence this week' },
	{ token: '{id}', description: 'Infraction ID' },
	{ token: '{count}', description: 'Their infraction count' },
	{ token: '{escalated}', description: 'Yes or No' },
	{ token: '{issuer}', description: 'Mentions the staff member' },
	{ token: '{issuer.name}', description: 'Staff member name' },
	{ token: '{issuer.id}', description: 'Staff member ID' },
	{ token: '{guild}', description: 'Server name' },
	{ token: '{guild.id}', description: 'Server ID' },
	{
		token: '{guild.icon}',
		description: 'Server icon URL',
		example: 'https://cdn.discordapp.com/...'
	},
	{
		token: '{timestamp}',
		description: 'Full timestamp',
		example: 'Monday, 24 August 2026 19:04'
	},
	{ token: '{timestamp.short}', description: 'Short timestamp', example: '24 August 2026 19:04' },
	{ token: '{timestamp.relative}', description: 'Relative time', example: '2 minutes ago' }
];

export function blankInfraction(id: number, name: string): InfractionType {
	return {
		id,
		name,
		end_shift: false,
		remove_ingame_perms: false,
		manager_roles: [],
		escalation: { threshold: 1, next_infraction: '' },
		role_changes: { add: blankRoleChange(), remove: blankRoleChange() },
		notifications: { dm: blankNotification(), public: blankNotification() },
		expiry: { enabled: false, duration: 30 }
	};
}

export interface PriorityPreset {
	name: string;
	value: string;
	time: number;
}

export interface PriorityRequestType {
	name: string;
	reason: string;
	min_players: number;
	max_players: number;
	cooldown: number;
}

export interface PrioritySettings {
	channel_id: string;
	mentioned_roles: string[];
	blacklisted_roles: string[];
	cooldown: number;
	global_cooldown: number;
	min_players: number;
	max_players: number;
	minimum_allowed_permission: number;
	peacetimer: number;
	presets: PriorityPreset[];
	request_types: PriorityRequestType[];
}

export interface Reminder {
	id: string;
	name: string;
	message: string;
	channel: string;
	role: string[];
	interval: number;
	lastTriggered: number;
	paused: boolean;
	completion_ability: boolean;
	integration: { type: '' | 'Message' | 'Hint'; content: string };
}

export const integrationTypes = [
	{ value: '', label: 'None' },
	{ value: 'Message', label: 'Message' },
	{ value: 'Hint', label: 'Hint' }
];

export const prefixes = ['!', '>', '?', ':', '-'];

export const whitelabelLimits = { botName: 32, bio: 190 };

export function validImageUrl(value: string): boolean {
	if (!value) return true;

	try {
		return new URL(value).protocol === 'https:';
	} catch {
		return false;
	}
}

export function validWhitelabel(settings: WhitelabelSettings): boolean {
	return (
		settings.botName.length <= whitelabelLimits.botName &&
		settings.bio.length <= whitelabelLimits.bio &&
		validImageUrl(settings.avatarUrl) &&
		validImageUrl(settings.bannerUrl)
	);
}

export const permissionLevels: { value: number; label: string }[] = [
	{ value: 0, label: 'Everyone' },
	{ value: 1, label: 'Staff' },
	{ value: 2, label: 'Admin' },
	{ value: 3, label: 'Management' }
];

export const punishmentPermissions: { value: number; label: string }[] = [
	{ value: 1, label: 'Moderator' },
	{ value: 2, label: 'Administrator' },
	{ value: 3, label: 'Management' }
];

export const defaultPunishmentTypes = ['Warning', 'Kick', 'Ban', 'BOLO'];

export const teamNames = ['Civilian', 'Police', 'Sheriff', 'Fire', 'DOT', 'Jail'];

export const ingameActions = [
	'send_message',
	'ping_role',
	'move_to_voice',
	'pm_player',
	'ingame_message',
	'ingame_hint'
] as const;

export type IngameAction = (typeof ingameActions)[number];

export const ingamePermissionLevels = ['staff', 'admin', 'management', 'roles'] as const;

export type IngamePermissionLevel = (typeof ingamePermissionLevels)[number];

export const punishmentLevels: { value: number; label: string }[] = [
	{ value: 1, label: 'Staff' },
	{ value: 2, label: 'Admin' },
	{ value: 3, label: 'Management' }
];

const googleProducts: Record<string, string> = {
	docs: 'Google Docs',
	sheets: 'Google Sheets',
	slides: 'Google Slides',
	forms: 'Google Forms',
	drawings: 'Google Drawings',
	sites: 'Google Sites',
	drive: 'Google Drive',
	vids: 'Google Vids'
};

const googlePaths: Record<string, string> = {
	document: 'Google Docs',
	spreadsheets: 'Google Sheets',
	presentation: 'Google Slides',
	forms: 'Google Forms',
	drawings: 'Google Drawings',
	videos: 'Google Vids'
};

export const documentationDomains = [
	...Object.keys(googleProducts).map((product) => `${product}.google.com`),
	'gitbook.io',
	'mintlify.app'
];

export function validDocumentationUrl(value: string): boolean {
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return false;
	}

	if (url.protocol !== 'https:') return false;
	return documentationDomains.some(
		(domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
	);
}

export function validDocumentationName(value: string): boolean {
	return value.trim().length >= 3 && value.trim().length <= 50;
}

export function documentationProvider(value: string): string {
	if (!validDocumentationUrl(value)) return '';

	const url = new URL(value);
	const host = url.hostname.toLowerCase();

	if (host.endsWith('gitbook.io')) return 'GitBook';
	if (host.endsWith('mintlify.app')) return 'Mintlify';

	const product = googleProducts[host.split('.')[0]] ?? 'Google Docs';
	if (host.split('.')[0] !== 'docs') return product;

	return googlePaths[url.pathname.split('/')[1] ?? ''] ?? 'Google Docs';
}

export function documentationIcon(entry: DocumentationType): string {
	if (entry.faviconURL) return entry.faviconURL;
	if (!validDocumentationUrl(entry.url)) return '';
	return `/api/icon?url=${encodeURIComponent(new URL(entry.url).origin)}`;
}

export function documentationEmbed(value: string): string {
	if (!validDocumentationUrl(value)) return '';

	const url = new URL(value);
	const host = url.hostname.toLowerCase();

	if (!host.endsWith('google.com')) return '';

	if (url.pathname.startsWith('/forms/')) {
		url.searchParams.set('embedded', 'true');
		return url.toString();
	}

	if (!/\/d\//.test(url.pathname)) return url.toString();

	url.hash = '';
	url.search = '';
	url.pathname = url.pathname
		.replace(/\/(edit|view|viewform|htmlview|pub|preview)\/?$/, '')
		.replace(/\/$/, '');

	return `${url.toString()}/preview`;
}
