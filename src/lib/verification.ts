import {
	blankMessage,
	ComponentType,
	isEmptyMessage,
	packMessage,
	usesComponentsV2,
	type DiscordMessage
} from './discord';
import type { MessageVariable } from './settings';

export interface VerificationSettings {
	enabled: boolean;
	auto_verify: boolean;
	command_enabled: boolean;
	channel_id: string;
	verified_roles: string[];
	unverified_roles: string[];
	nickname: string;
	min_account_age: number;
	dm_enabled: boolean;
	message: DiscordMessage;
	dm_message: DiscordMessage;
}

export const verifyButtonId = 'erm_verify';

export const verifyButtonRoles = [{ value: verifyButtonId, label: 'Verify' }];

export const nicknameLimit = 32;
export const maxAccountAge = 3650;
export const maxButtonRows = 5;
export const maxRowButtons = 5;

export const verificationVariables: MessageVariable[] = [
	{ token: '{roblox.username}', description: 'Their Roblox username', example: 'drrobl0xx' },
	{ token: '{roblox.display_name}', description: 'Their Roblox display name', example: 'Ethan' },
	{ token: '{roblox.id}', description: 'Their Roblox user ID', example: '3469222247' },
	{ token: '{member.mention}', description: 'Mentions the member' },
	{ token: '{member.name}', description: 'Their Discord username', example: 'yeetgodpro1324' },
	{ token: '{member.id}', description: 'Their Discord user ID' },
	{ token: '{guild.name}', description: 'Your server name', example: 'California Roleplay' },
	{ token: '{guild.members}', description: 'Your member count', example: '1204' }
];

export const nicknameVariables = verificationVariables.filter(
	(entry) => !entry.token.startsWith('{guild.')
);

export const verifyMessageVariables = verificationVariables.filter((entry) =>
	entry.token.startsWith('{guild.')
);

export function packVerificationMessage(message: DiscordMessage): string {
	return isEmptyMessage(message) ? '' : JSON.stringify(packMessage(message));
}

export function blankVerification(): VerificationSettings {
	return {
		enabled: false,
		auto_verify: true,
		command_enabled: true,
		channel_id: '',
		verified_roles: [],
		unverified_roles: [],
		nickname: '',
		min_account_age: 0,
		dm_enabled: false,
		message: blankMessage(),
		dm_message: blankMessage()
	};
}

export function hasVerifyButton(message: DiscordMessage): boolean {
	return message.components.some(
		(component) =>
			component.type === ComponentType.ActionRow &&
			component.components.some((button) => button.custom_id === verifyButtonId)
	);
}

export function roomForVerifyButton(message: DiscordMessage): boolean {
	if (hasVerifyButton(message)) return true;
	if (usesComponentsV2(message)) return false;

	return (
		message.components.length < maxButtonRows ||
		message.components.some(
			(component) =>
				component.type === ComponentType.ActionRow && component.components.length < maxRowButtons
		)
	);
}

export function verificationProblem(settings: VerificationSettings): string {
	if (!settings.enabled) return '';

	if (!settings.verified_roles.length && !settings.nickname.trim()) {
		return 'Pick a verified role or a nickname, otherwise verifying does nothing.';
	}

	if (!settings.channel_id && !settings.auto_verify) {
		return 'Pick a channel for the verify message, or turn on automatic verification.';
	}

	if (settings.channel_id && isEmptyMessage(settings.message)) {
		return 'Your verify message is empty, so there would be nothing to post.';
	}

	if (
		settings.channel_id &&
		usesComponentsV2(settings.message) &&
		!hasVerifyButton(settings.message)
	) {
		return 'Add a button set to Verify, this message layout cannot have one added for you.';
	}

	if (settings.channel_id && !roomForVerifyButton(settings.message)) {
		return 'Your buttons are full, remove one or set one to Verify so members can verify.';
	}

	if (settings.nickname.length > nicknameLimit) {
		return `Nicknames cannot be longer than ${nicknameLimit} characters.`;
	}

	if (settings.min_account_age < 0 || settings.min_account_age > maxAccountAge) {
		return `Minimum account age has to be between 0 and ${maxAccountAge} days.`;
	}

	if (settings.dm_enabled && isEmptyMessage(settings.dm_message)) {
		return 'Turn off the direct message or write one, it is empty right now.';
	}

	return '';
}

export function sendProblem(settings: VerificationSettings): string {
	if (!settings.enabled) return 'Turn verification on and save before posting the message.';
	if (!settings.channel_id) return 'Pick a verify channel and save before posting the message.';
	if (isEmptyMessage(settings.message)) return 'Write a verify message and save before posting it.';

	return verificationProblem(settings);
}

export function overlappingRoles(settings: VerificationSettings): string[] {
	return settings.verified_roles.filter((role) => settings.unverified_roles.includes(role));
}
