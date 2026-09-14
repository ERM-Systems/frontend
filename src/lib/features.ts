import AlarmClock from '@lucide/svelte/icons/alarm-clock';
import BellOff from '@lucide/svelte/icons/bell-off';
import Bot from '@lucide/svelte/icons/bot';
import CalendarOff from '@lucide/svelte/icons/calendar-off';
import ClipboardList from '@lucide/svelte/icons/clipboard-list';
import Clock4 from '@lucide/svelte/icons/clock-4';
import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
import Gavel from '@lucide/svelte/icons/gavel';
import History from '@lucide/svelte/icons/history';
import Layers from '@lucide/svelte/icons/layers';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import Mic from '@lucide/svelte/icons/mic';
import Radio from '@lucide/svelte/icons/radio';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import ShieldAlert from '@lucide/svelte/icons/shield-alert';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import Siren from '@lucide/svelte/icons/siren';
import TrendingUp from '@lucide/svelte/icons/trending-up';
import TvMinimal from '@lucide/svelte/icons/tv-minimal';
import Users from '@lucide/svelte/icons/users';
import Workflow from '@lucide/svelte/icons/workflow';
import type { Picture } from '@sveltejs/enhanced-img';
import applications from '$lib/assets/features/applications.png?enhanced';
import modpanel from '$lib/assets/features/modpanel.png?enhanced';
import serverSettings from '$lib/assets/features/server-settings.png?enhanced';

export interface Feature {
	slug: string;
	title: string;
	group: string;
	summary: string;
	body: string[];
	points: string[];
	image?: Picture;
	icon: typeof ShieldCheck;
}

export const features: Feature[] = [
	{
		slug: 'moderator-panel',
		title: 'Moderator Panel',
		group: 'Moderation',
		summary: 'Moderate efficiently with an all-in-one panel.',
		body: [
			'The panel puts your live ER:LC server and your Discord moderation on the same page. Your team can see who is playing, who is on duty and what has already been actioned, then punish, log or respond without opening anything else.',
			'Logs stream in as they happen, filtered down to joins, kills, commands or moderator calls. The server card tracks players, staff in game, the queue and vehicles, punishments sit beside it with the full history for anyone you search, and your own shift stays in the corner with break and end controls.',
			'Every panel can be moved around, so the layout matches the way your team actually moderates rather than the way we guessed.'
		],
		points: [
			'Live log feed with joins, kills, commands and moderator calls',
			'Punish any player by username, with their history beside it',
			'Players, staff in game, queue and vehicles at a glance',
			'BOLOs, priorities and staff requests in the same view',
			'Start, break and end your shift without leaving the page'
		],
		image: modpanel,
		icon: ShieldCheck
	},
	{
		slug: 'copilot',
		title: 'Copilot',
		group: 'Moderation',
		summary: 'Moderate with your voice with our accurate voice assistant.',
		body: [
			'Copilot lets moderators run actions by speaking instead of typing. It is built for the moments where reading chat, driving and moderating all happen at once, so the panel keeps working while your hands are busy.'
		],
		points: [],
		icon: Mic
	},
	{
		slug: 'punishments',
		title: 'Punishments',
		group: 'Moderation',
		summary: 'Custom punishment types with their own permissions and logs.',
		body: [
			'Define the punishments your server actually uses instead of the ones a bot decides for you. Each type carries its own name, permission level and log channel, so warnings, kicks and bans all land where your team expects them.',
			'Everything issued stays on the player record, searchable by username and filterable by type from the panel, so the next moderator to deal with them already knows the history.'
		],
		points: [
			'Build your own punishment types',
			'Restrict each type to a permission level',
			'Send punishment logs to the channel you choose',
			'Every moderation stays on the player record'
		],
		icon: Gavel
	},
	{
		slug: 'applications',
		title: 'Applications',
		group: 'Staff',
		summary: 'Create applications and collect responses with ease.',
		body: [
			'Build the forms people apply through, share a public link, then review what comes in from the dashboard. Nothing runs through a Google Form your applicants have to be trusted with.',
			'Forms are built question by question, up to a hundred of them, with sections, required answers, validation rules and drag to reorder. A banner and a markdown description sit at the top of what applicants see, and you can preview the whole form the way they will read it.',
			'Responses collect under their own tab with a count on it, so accepting and denying happens in the same place the form was written.'
		],
		points: [
			'Up to 100 questions, grouped into sections',
			'Validation rules so answers arrive usable',
			'Banner and markdown description on the public form',
			'Preview the form exactly as applicants see it',
			'Duplicate an application to reuse its questions'
		],
		image: applications,
		icon: ClipboardList
	},
	{
		slug: 'shift-management',
		title: 'Shift Management',
		group: 'Staff',
		summary: 'Track staff hours, breaks and quotas without lifting a finger.',
		body: [
			'Staff go on duty and ERM does the rest. Shifts assign roles, rename members and count towards quota automatically, so you always know how much your team is really working.',
			'Breaks pause the clock instead of ending the shift, and every shift is kept, so a member behind on quota can be shown exactly which weeks they missed.'
		],
		points: [
			'On-duty roles applied and removed automatically',
			'Nickname prefixes while a shift is running',
			'Server and per-role quotas',
			'Separate shift types for different teams',
			'Breaks that pause the clock'
		],
		icon: Clock4
	},
	{
		slug: 'infractions',
		title: 'Infractions',
		group: 'Staff',
		summary: 'Infraction types that escalate on their own.',
		body: [
			'Record what your team has been handed, and let repeat infractions escalate without anyone tracking counts by hand. Set a threshold on a type and the next one up is issued automatically once it is reached.',
			'Each type can strip in-game admin permissions or end the shift the member is on the moment it is issued, so a demotion actually takes effect instead of waiting for someone to remember.'
		],
		points: [
			'Your own infraction types and reasons',
			'Automatic escalation once a threshold is reached',
			'Optionally strip in-game admin permissions',
			'Optionally end the shift the member is on'
		],
		icon: Users
	},
	{
		slug: 'activity-waves',
		title: 'Activity Waves',
		group: 'Staff',
		summary: 'Check who is behind on quota, then infract them in one pass.',
		body: [
			'Activity waves compare every staff member against their quota for a period and show you the shortfall before anything is issued.',
			'Pick the infraction type, choose who it applies to, skip anyone with approved leave, and run it once. A shared reason goes out with the wave so nobody has to be told individually.'
		],
		points: [
			'Preview everyone below quota before issuing',
			'Choose the infraction type and period',
			'Skip members with an approved leave of absence',
			'Select exactly who to infract'
		],
		icon: TrendingUp
	},
	{
		slug: 'time-off',
		title: 'Leave and Reduced Activity',
		group: 'Staff',
		summary: 'Full or partial time off, handled through requests.',
		body: [
			'Leave of absence covers full time off with no quota expected, while reduced activity keeps a smaller quota in place. Both run through the same request flow, so nobody gets infracted for time you already approved.',
			'Administrators approve or deny requests, and activity waves respect anything that is still running.'
		],
		points: [
			'Requests approved or denied by your team',
			'Quota expectations adjusted while they run',
			'Leave respected by activity waves'
		],
		icon: CalendarOff
	},
	{
		slug: 'game-integration',
		title: 'Game Integration',
		group: 'Game',
		summary: 'Connect your ER:LC server and act on it from Discord.',
		body: [
			'Add your ER:LC server key once and ERM can read and act on the server directly. Commands run remotely from Discord or the panel, and the logs come straight back.',
			'Restrictions are enforced without a moderator watching for them. Restricted vehicles move the driver off the team, and RDM is detected and sent to the roles you pick.'
		],
		points: [
			'Run in-game commands from Discord and the panel',
			'Kill logs, player logs and command logs',
			'Restricted vehicles moved off the team automatically',
			'RDM alerts sent to the roles you choose'
		],
		icon: Gamepad2
	},
	{
		slug: 'game-logging',
		title: 'Game Logging',
		group: 'Game',
		summary: 'Mirror what happens in your ER:LC server into Discord.',
		body: [
			'Everything worth keeping from in game ends up in the channels you pick. Message logs, priority calls, STS and staff requests all arrive without anyone screenshotting them.',
			'Each log type has its own channel, so moderation calls do not get buried under chat.'
		],
		points: [
			'In-game message logs',
			'Priority and STS logs',
			'Staff request logs',
			'A separate channel per log type'
		],
		icon: ScrollText
	},
	{
		slug: 'game-automation',
		title: 'Game Automation',
		group: 'Game',
		summary: 'What ERM does inside your server without being asked.',
		body: [
			'Automation keeps your in-game permissions matched to Discord. Staff roles sync to moderator and administrator in game, so a promotion in Discord is a promotion in the server.',
			'Players can be checked against your Discord when they join, and live counts feed into voice or text channels your community can see.'
		],
		points: [
			'Permission sync between Discord roles and in-game admin',
			'Discord membership checks on join',
			'Statistics channels for live counts'
		],
		icon: Workflow
	},
	{
		slug: 'sessions',
		title: 'Sessions',
		group: 'Game',
		summary: 'Run session votes and startup messages from the dashboard.',
		body: [
			'Open your server the same way every time. Votes gather interest, the startup message goes out once the threshold is met, and the shutdown message closes it off.',
			'Every session is recorded, so you can look back at how many turned up and how long it ran.'
		],
		points: [
			'Session votes with a player threshold',
			'Startup and shutdown messages',
			'A full record of every session run'
		],
		icon: Radio
	},
	{
		slug: 'priorities',
		title: 'Priorities',
		group: 'Game',
		summary: 'Let players request scenario time, on your terms.',
		body: [
			'Players request priority in game and ERM handles the rest. Request types and presets keep scenarios consistent instead of being written from scratch each time.',
			'Player and server cooldowns stop the same person asking every five minutes, and peacetime can be called when the server needs to settle.'
		],
		points: [
			'Custom request types and presets',
			'Player and server cooldowns',
			'Peacetime control',
			'Priority logs in Discord'
		],
		icon: Siren
	},
	{
		slug: 'security',
		title: 'Game Security',
		group: 'Game',
		summary: 'Watch your server for unusual activity and alert your team.',
		body: [
			'Security watches for the patterns that usually mean trouble and tells the people who can act on it.',
			'Alerts go to the channel you pick and mention the roles you choose, so a mass RDM at three in the morning does not sit unnoticed until someone scrolls back.'
		],
		points: [
			'Alerts for unusual in-game activity',
			'A dedicated alert channel',
			'Roles mentioned when something fires'
		],
		icon: ShieldAlert
	},
	{
		slug: 'mass-actions',
		title: 'Mass Actions',
		group: 'Game',
		summary: 'Bulk actions that run in game against your server.',
		body: [
			'Some jobs are not worth doing one player at a time. Mass actions run them in a single pass against your ER:LC server.',
			'They are limited to management and rate limited per action, so a mistake cannot run away from you.'
		],
		points: ['Bulk unbans and ban list clearing', 'Management only', 'Rate limited per action'],
		icon: Layers
	},
	{
		slug: 'dashboard',
		title: 'Dashboard',
		group: 'Server',
		summary: 'Set up your whole server without learning a command.',
		body: [
			'Every setting ERM has lives in one dashboard, grouped by what it affects and searchable the moment you know what you are looking for.',
			'Roles decide who reaches what, and permission levels are read top to bottom. Staff manage their own shifts and punishments, administrators moderate other staff and approve leave, and management can change anything, including these settings.',
			'Nothing is hidden behind a command. Every change is written to the audit log with the name of whoever made it.'
		],
		points: [
			'Search every setting by name',
			'View & manage your staff with a few clicks',
			'Easily manage sessions, priorities and applications',
			'See who changed what, and when'
		],
		image: serverSettings,
		icon: LayoutDashboard
	},
	{
		slug: 'server-overview',
		title: 'Server Overview',
		group: 'Server',
		summary: 'A public page anyone can open to see your live server.',
		body: [
			'Give your community one link that shows what is happening right now, without them having to be in Discord to check.',
			'Player counts, on-duty staff and session status sit under your own banner, tagline and accent colour, next to whichever links you want people to follow.'
		],
		points: [
			'Live player and staff counts',
			'Your banner, tagline and accent colour',
			'Custom links and a join button',
			'Choose which panels are public'
		],
		icon: TvMinimal
	},
	{
		slug: 'whitelabel',
		title: 'Whitelabel',
		group: 'Server',
		summary: 'Run ERM under your own bot name, avatar and banner.',
		body: [
			'Whitelabel puts your branding on the bot itself. Members see your name, your avatar and your banner in the member list and on every message it sends.',
			'Everything underneath is still ERM, so features and updates arrive the same way they always have.'
		],
		points: ['Your own bot name and avatar', 'Custom banner and bio', 'Applies across your server'],
		icon: Bot
	},
	{
		slug: 'anti-ping',
		title: 'Anti-Ping',
		group: 'Server',
		summary: 'Warn users who ping protected roles.',
		body: [
			'Stop members pinging your staff at three in the morning. Protected roles get a warning sent on their behalf the moment someone mentions them.',
			'A hierarchy keeps it usable, so staff can still reach the people above them and bypass roles are left alone.'
		],
		points: [
			'Protect the roles you choose',
			'Custom warning message',
			'Bypass roles and hierarchy'
		],
		icon: BellOff
	},
	{
		slug: 'reminders',
		title: 'Reminders',
		group: 'Server',
		summary: 'Let ERM remind your community, so you do not have to.',
		body: [
			'Recurring messages on their own timers. Rules reminders, session announcements and staff nudges all go out on schedule.',
			'Each one runs on its own interval, in the channel you pick, mentioning the roles that need to see it.'
		],
		points: [
			'Each reminder runs on its own interval',
			'Any channel, any message',
			'Mention the roles that need to see it'
		],
		icon: AlarmClock
	},
	{
		slug: 'audit-log',
		title: 'Audit Log',
		group: 'Server',
		summary: 'Every change made from the dashboard, and who made it.',
		body: [
			'When a setting changes, the audit log records what it was, what it became and who did it.',
			'Only management can read it, so there is always an answer to who turned that off, without anyone having to be trusted on their word.'
		],
		points: ['Every dashboard change recorded', 'Before and after values', 'Management only'],
		icon: History
	}
];

export const featureGroups = [...new Set(features.map((feature) => feature.group))];

export function findFeature(slug: string): Feature | undefined {
	return features.find((feature) => feature.slug === slug);
}
