import { blankMessage, type DiscordMessage } from '$lib/discord';
import type { MessageVariable } from '$lib/settings';

export type SessionMessage = 'vote' | 'staff_vote' | 'start' | 'boost' | 'full' | 'shutdown';

export interface SessionSettings {
	channel_id: string;
	dynamic_button: boolean;
	vote_button_label: string;
	required_votes_default: number;
	start_mention_roles: string[];
	poll_mention_roles: string[];
	end_staff_shifts: boolean;
	auto_full: boolean;
	boost_threshold: number;
	boost_mention_roles: string[];
	auto_kick: boolean;
	auto_kick_grace: number;
	channel_locks: { enabled: boolean; channels: string[]; role: string };
	vote: DiscordMessage;
	staff_vote: DiscordMessage;
	start: DiscordMessage;
	boost: DiscordMessage;
	full: DiscordMessage;
	shutdown: DiscordMessage;
}

export interface ActiveSession {
	started: boolean;
	dynamic: boolean;
	votes: number;
	requiredVotes: number;
	votedUsers: string[];
	startedBy: string;
	maxPlayers: number;
	playerCounts: number[];
	channelId: string;
	messageId: string;
	voteMessageId: string;
	playersInGame: number;
	votersInGame: number;
	votersLinked: number;
}

export interface SessionHistoryEntry {
	id: string;
	startedBy: string;
	endedBy: string;
	startedAt: number;
	endedAt: number;
	votes: number;
	votedUsers: string[];
	maxPlayers: number;
	playerCounts: number[];
	commands: number;
	kills: number;
	joins: number;
}

export const sessionLimits = { voteButtonLabel: 80, requiredVotes: 250 };

export const voteButtonId = 'vote_button';
export const viewVotesButtonId = 'view_votes_button';

export const voteButtonRoles = [
	{ value: voteButtonId, label: 'Count a vote' },
	{ value: viewVotesButtonId, label: 'Show who voted' }
];

export const voteMessages: SessionMessage[] = ['vote', 'staff_vote'];

export const sessionMessages: { id: SessionMessage; label: string; description: string }[] = [
	{
		id: 'vote',
		label: 'Vote',
		description: 'Posted by /session vote to gather votes before a session starts.'
	},
	{
		id: 'staff_vote',
		label: 'Staff Vote',
		description: 'Posted by /session vote with staff only turned on, where only staff can vote.'
	},
	{
		id: 'start',
		label: 'Start',
		description: 'Posted by /session start once the server is open.'
	},
	{
		id: 'boost',
		label: 'Boost',
		description: 'Posted by /session boost to ask for more players in a running session.'
	},
	{
		id: 'full',
		label: 'Full',
		description: 'Posted once on its own when the server hits its player limit.'
	},
	{
		id: 'shutdown',
		label: 'End',
		description: 'Posted by /session end when the session is over.'
	}
];

const voteVariables: MessageVariable[] = [
	{ token: '{user}', description: 'Mentions whoever called the vote' },
	{ token: '{vote_button_name}', description: 'The label on the vote button' },
	{ token: '{required_members}', description: 'Votes needed to start', example: '5' }
];

const serverVariables: MessageVariable[] = [
	{ token: '{erlc.name}', description: 'Your ER:LC server name', example: 'ERM Roleplay' },
	{ token: '{erlc.code}', description: 'Your ER:LC join code', example: 'ermrp' },
	{
		token: '{erlc.players}',
		description: 'Live player count, refreshed every 5 minutes',
		example: '24'
	}
];

const startVariables: MessageVariable[] = [
	{ token: '{user}', description: 'Mentions whoever started the session' },
	{ token: '{user_mentions}', description: 'Mentions everyone who voted' },
	...serverVariables
];

const boostVariables: MessageVariable[] = [
	{ token: '{user}', description: 'Mentions whoever asked for the boost' },
	...serverVariables
];

const fullVariables: MessageVariable[] = [
	...serverVariables,
	{ token: '{erlc.max_players}', description: 'How many players your server holds', example: '32' }
];

const shutdownVariables: MessageVariable[] = [
	{ token: '{user}', description: 'Mentions whoever ended the session' },
	{ token: '{erlc.name}', description: 'Your ER:LC server name', example: 'ERM Roleplay' },
	{ token: '{erlc.code}', description: 'Your ER:LC join code', example: 'ermrp' },
	{ token: '{erlc.max_players}', description: 'Peak player count this session', example: '31' }
];

export const sessionVariables: Record<SessionMessage, MessageVariable[]> = {
	vote: voteVariables,
	staff_vote: voteVariables,
	start: startVariables,
	boost: boostVariables,
	full: fullVariables,
	shutdown: shutdownVariables
};

export function blankSessionSettings(): SessionSettings {
	return {
		channel_id: '',
		dynamic_button: false,
		vote_button_label: 'Vote',
		required_votes_default: 5,
		start_mention_roles: [],
		poll_mention_roles: [],
		end_staff_shifts: false,
		auto_full: false,
		boost_threshold: 0,
		boost_mention_roles: [],
		auto_kick: false,
		auto_kick_grace: 60,
		channel_locks: { enabled: false, channels: [], role: '' },
		vote: blankMessage(),
		staff_vote: blankMessage(),
		start: blankMessage(),
		boost: blankMessage(),
		full: blankMessage(),
		shutdown: blankMessage()
	};
}
