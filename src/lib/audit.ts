const labels: Record<string, string> = {
	SaveServerSettings: 'Updated server settings',
	SetERLCServerKey: 'Updated the ER:LC server key',
	GenerateWebhookToken: 'Generated a webhook token',
	SaveWebhookSettings: 'Updated webhook settings',
	'panel/whitelabel': 'Updated whitelabel settings',
	CreateDocumentationType: 'Created a documentation type',
	EditDocumentationType: 'Updated a documentation type',
	DeleteDocumentationType: 'Deleted a documentation type',
	SavePunishmentType: 'Updated a punishment type',
	EditPunishmentType: 'Updated a punishment type',
	DeletePunishmentType: 'Deleted a punishment type',
	SetServerPunishmentPreset: 'Saved a punishment preset',
	DeleteServerPunishmentPreset: 'Deleted a punishment preset',
	SaveServerShifts: 'Updated shift settings',
	DeleteShiftType: 'Deleted a shift type',
	DeleteRoleQuota: 'Deleted a role quota',
	DeleteReminder: 'Deleted a reminder',
	TriggerReminder: 'Triggered a reminder',
	CreateApplication: 'Created an application form',
	DeleteApplication: 'Deleted an application form',
	ApproveApplication: 'Approved an application',
	DenyApplication: 'Denied an application',
	SubmitResponse: 'Submitted an application response',
	DeleteResponse: 'Deleted an application response',
	UnstageAllResponses: 'Unstaged all application responses',
	AddComment: 'Added a comment',
	EditComment: 'Edited a comment',
	DeleteComment: 'Deleted a comment',
	CreateInfraction: 'Created an infraction',
	Infractions: 'Changed an infraction',
	'Infractions/Revoke': 'Revoked an infraction',
	StartInfractionWave: 'Started an activity wave',
	CreateModeration: 'Created a punishment',
	UpdatePunishment: 'Updated a punishment',
	DeletePunishment: 'Deleted a punishment',
	CreatePriority: 'Created a priority',
	UpdatePriority: 'Updated a priority',
	DeletePriority: 'Deleted a priority',
	AddPriorityComment: 'Commented on a priority',
	StartSession: 'Started a session',
	EndSession: 'Ended a session',
	CreateSessionVote: 'Started a session vote',
	AcceptLOA: 'Accepted a leave of absence',
	DenyLOA: 'Denied a leave of absence',
	StartUserLOA: 'Started a leave of absence',
	EndUserLOA: 'Ended a leave of absence',
	ForceStartLOA: 'Force started a leave of absence',
	ForceEndLOA: 'Force ended a leave of absence',
	DeleteUserLOA: 'Deleted a leave of absence',
	StartShift: 'Started a shift',
	EndShift: 'Ended a shift',
	ForceStartShift: 'Force started a shift',
	ForceEndShift: 'Force ended a shift',
	VoidShift: 'Voided a shift',
	ToggleBreak: 'Toggled a shift break',
	AddTime: 'Adjusted shift time',
	BlacklistUser: 'Blacklisted a user',
	SendStaffRequest: 'Sent a staff request',
	AckStaffRequest: 'Acknowledged a staff request',
	BanPlayer: 'Banned a player',
	BringPlayer: 'Brought a player',
	TeleportPlayer: 'Teleported a player',
	UnjailPlayer: 'Unjailed a player',
	WantedPlayer: 'Marked a player wanted',
	UnwantedPlayer: 'Cleared a player as wanted',
	GlobalMessage: 'Sent a global message'
};

export function auditTarget(details: unknown): string {
	if (!details || typeof details !== 'object') return '';

	const params = (details as Record<string, unknown>).params;
	if (!params || typeof params !== 'object') return '';

	return Object.values(params as Record<string, unknown>)
		.filter((value) => typeof value === 'string' && value)
		.join(', ');
}

export function auditLabel(action: string): string {
	const known = labels[action];
	if (known) return known;

	const name = action.split('/').pop() ?? action;

	return (
		name
			.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
			.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
			.trim() || action
	);
}
