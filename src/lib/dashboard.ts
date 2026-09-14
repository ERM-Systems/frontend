import AlarmClock from '@lucide/svelte/icons/alarm-clock';
import BellOff from '@lucide/svelte/icons/bell-off';
import Bot from '@lucide/svelte/icons/bot';
import CalendarClock from '@lucide/svelte/icons/calendar-clock';
import ClipboardList from '@lucide/svelte/icons/clipboard-list';
import CalendarOff from '@lucide/svelte/icons/calendar-off';
import Clock4 from '@lucide/svelte/icons/clock-4';
import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
import Gavel from '@lucide/svelte/icons/gavel';
import History from '@lucide/svelte/icons/history';
import Layers from '@lucide/svelte/icons/layers';
import Radio from '@lucide/svelte/icons/radio';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import KeyRound from '@lucide/svelte/icons/key-round';
import Settings2 from '@lucide/svelte/icons/settings-2';
import BadgeCheck from '@lucide/svelte/icons/badge-check';
import ShieldAlert from '@lucide/svelte/icons/shield-alert';
import Siren from '@lucide/svelte/icons/siren';
import TvMinimal from '@lucide/svelte/icons/tv-minimal';
import Users from '@lucide/svelte/icons/users';
import Workflow from '@lucide/svelte/icons/workflow';
import type { ResolvedPathname } from '$app/types';

export interface DashboardPage {
	slug: string;
	label: string;
	group: string;
	description: string;
	icon: typeof Settings2;
	keywords: string[];
	reviewer?: boolean;
	limited?: { level: number; slug: string };
}

export interface DashboardAccess {
	level: number;
	reviewer: boolean;
	mode?: string;
	granted?: Record<string, boolean>;
}

export const managementLevel = 3;
export const administratorLevel = 2;

export const dashboardPages: DashboardPage[] = [
	{
		slug: 'basic',
		icon: Settings2,
		label: 'Basic Settings',
		group: 'Server',
		description: 'Roles, prefix and documentation.',
		keywords: ['staff role', 'management role', 'admin role', 'prefix', 'documentation']
	},
	{
		slug: 'permissions',
		icon: KeyRound,
		label: 'Permissions',
		group: 'Server',
		description: 'Custom roles deciding who can use what.',
		keywords: ['permissions', 'roles', 'access', 'granular', 'custom roles', 'commands', 'who can']
	},
	{
		slug: 'server-overview',
		icon: TvMinimal,
		label: 'Server Overview',
		group: 'Server',
		description: 'The public page showing your live server.',
		keywords: ['overview', 'public', 'live', 'status page', 'share', 'players', 'panels']
	},
	{
		slug: 'whitelabel',
		icon: Bot,
		label: 'Whitelabel',
		group: 'Server',
		description: 'Run ERM under your own bot branding.',
		keywords: ['whitelabel', 'branding', 'bot name', 'avatar', 'banner', 'bio', 'appearance']
	},
	{
		slug: 'anti-ping',
		icon: BellOff,
		label: 'Anti-Ping',
		group: 'Server',
		description: 'Stop members pinging your staff.',
		keywords: ['ping', 'mention', 'hierarchy', 'bypass']
	},
	{
		slug: 'reminders',
		icon: AlarmClock,
		label: 'Reminders',
		group: 'Server',
		description: 'Recurring messages on a timer.',
		keywords: ['recurring', 'schedule', 'interval', 'message']
	},
	{
		slug: 'shift-management',
		icon: Clock4,
		label: 'Shift Management',
		group: 'Staff',
		description: 'On-duty roles, quotas and shift types.',
		keywords: ['shifts', 'quota', 'on duty', 'nickname', 'shift types']
	},
	{
		slug: 'loa',
		icon: CalendarOff,
		label: 'Leave of Absence',
		group: 'Staff',
		description: 'Full time off with no quota expected.',
		keywords: ['loa', 'leave of absence', 'time off', 'leave']
	},
	{
		slug: 'reduced-activity',
		icon: CalendarClock,
		label: 'Reduced Activity',
		group: 'Staff',
		description: 'Partial time off with a reduced quota.',
		keywords: ['ra', 'reduced activity', 'quota', 'partial']
	},
	{
		slug: 'staff-management',
		icon: Users,
		label: 'Staff Management',
		group: 'Staff',
		description: 'Infractions, activity waves and your staff roster.',
		keywords: ['infractions', 'activity wave', 'staff overview', 'roster', 'activity', 'promotion'],
		limited: { level: administratorLevel, slug: 'staff-management' }
	},
	{
		slug: 'applications',
		icon: ClipboardList,
		label: 'Applications',
		group: 'Staff',
		description: 'Build application forms and review who applies.',
		keywords: ['application', 'form', 'apply', 'questions', 'responses', 'ban appeal', 'points'],
		reviewer: true
	},
	{
		slug: 'verification',
		icon: BadgeCheck,
		label: 'Verification',
		group: 'Server',
		description: 'Link Roblox accounts and hand out roles.',
		keywords: ['verify', 'roblox', 'link', 'verification', 'nickname', 'auto role', 'bloxlink']
	},
	{
		slug: 'punishments',
		icon: Gavel,
		label: 'Punishments',
		group: 'Moderation',
		description: 'Logging channels and punishment types.',
		keywords: ['warning', 'kick', 'ban', 'bolo', 'moderation', 'types', 'manage punishments'],
		limited: { level: administratorLevel, slug: 'punishments/manage' }
	},
	{
		slug: 'game-logging',
		icon: ScrollText,
		label: 'Game Logging',
		group: 'Game',
		description: 'Messages, priorities, STS and staff requests.',
		keywords: ['message logs', 'sts', 'priority logs', 'staff requests']
	},
	{
		slug: 'sessions',
		icon: Radio,
		label: 'Sessions',
		group: 'Game',
		description: 'Session votes, start and shutdown messages.',
		keywords: ['session', 'vote', 'startup', 'shutdown', 'sessions', 'open', 'close'],
		limited: { level: administratorLevel, slug: 'sessions' }
	},
	{
		slug: 'security',
		icon: ShieldAlert,
		label: 'Game Security',
		group: 'Game',
		description: 'Alerts for unusual in-game activity.',
		keywords: ['security', 'alerts', 'webhook', 'exploit']
	},
	{
		slug: 'priorities',
		icon: Siren,
		label: 'Priorities',
		group: 'Game',
		description: 'Priority requests, presets and cooldowns.',
		keywords: ['priority', 'peacetime', 'cooldown', 'presets', 'request types']
	},
	{
		slug: 'game-integration',
		icon: Gamepad2,
		label: 'Game Integration',
		group: 'Game',
		description: 'ER:LC server key, moderation and restrictions.',
		keywords: [
			'erlc',
			'server key',
			'kill logs',
			'player logs',
			'rdm',
			'vehicles',
			'teams',
			'weather',
			'welcome'
		]
	},
	{
		slug: 'game-automation',
		icon: Workflow,
		label: 'Game Automation',
		group: 'Game',
		description: 'Permission sync, Discord checks and statistics channels.',
		keywords: [
			'permission sync',
			'moderator',
			'administrator',
			'discord check',
			'statistics',
			'voice',
			'counter'
		]
	},
	{
		slug: 'mass-actions',
		icon: Layers,
		label: 'Mass Actions',
		group: 'Advanced',
		description: 'Bulk in game actions against your ER:LC server.',
		keywords: ['mass', 'bulk', 'unban', 'mass unban', 'bans', 'ban list', 'clear bans']
	},
	{
		slug: 'audit-log',
		icon: History,
		label: 'Audit Log',
		group: 'Advanced',
		description: 'Every change your management team makes.',
		keywords: ['audit', 'log', 'history', 'changes', 'who', 'accountability', 'trail']
	}
];

export const dashboardGroups = [...new Set(dashboardPages.map((page) => page.group))];

export function dashboardHref(guildId: string, slug: string): ResolvedPathname {
	return `/${guildId}/dashboard/${slug}` as ResolvedPathname;
}

export function pageEntry(page: DashboardPage, access: DashboardAccess): string | null {
	if (access.level >= managementLevel) return page.slug;
	if (page.reviewer && access.reviewer) return page.slug;
	if (page.limited && access.level >= page.limited.level) return page.limited.slug;
	if (access.granted?.[`dashboard.${page.slug}.view`]) return page.slug;

	return null;
}

export function landingSlug(access: DashboardAccess): string {
	for (const page of dashboardPages) {
		const entry = pageEntry(page, access);
		if (entry) return entry;
	}

	return 'basic';
}

export function matchesPage(page: DashboardPage, term: string): boolean {
	if (!term) return true;

	return (
		page.label.toLowerCase().includes(term) ||
		page.description.toLowerCase().includes(term) ||
		page.keywords.some((keyword) => keyword.includes(term))
	);
}
