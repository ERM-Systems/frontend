export const antiPingActions = ['timeout', 'kick'] as const;
export const antiPingShiftModes = ['always', 'off_duty', 'on_duty'] as const;

export type AntiPingAction = (typeof antiPingActions)[number];
export type AntiPingShiftMode = (typeof antiPingShiftModes)[number];

export interface AntiPingEscalation {
	enabled: boolean;
	threshold: number;
	window: number;
	action: AntiPingAction;
	duration: number;
}

export interface AntiPingShift {
	mode: AntiPingShiftMode;
	grace: number;
	break_off_duty: boolean;
}

export interface AntiPingRule {
	id: string;
	name: string;
	enabled: boolean;
	role: string[];
	bypass_role: string[];
	ignored_channels: string[];
	log_channel: string;
	use_hierarchy: boolean;
	escalation: AntiPingEscalation;
	shift: AntiPingShift;
}

export interface AntiPing {
	enabled: boolean;
	rules: AntiPingRule[];
}

export const maxRules = 10;
export const maxRuleName = 60;

export function emptyAntiPingRule(name: string): AntiPingRule {
	return {
		id: crypto.randomUUID(),
		name,
		enabled: true,
		role: [],
		bypass_role: [],
		ignored_channels: [],
		log_channel: '',
		use_hierarchy: false,
		escalation: {
			enabled: false,
			threshold: 3,
			window: 600,
			action: 'timeout',
			duration: 300
		},
		shift: { mode: 'always', grace: 0, break_off_duty: false }
	};
}

export function ruleSummary(rule: AntiPingRule): string {
	const parts = [`${rule.role.length} protected`];

	if (rule.bypass_role.length) parts.push(`${rule.bypass_role.length} exempt`);
	if (rule.ignored_channels.length) parts.push(`${rule.ignored_channels.length} ignored`);
	if (rule.shift.mode !== 'always') {
		parts.push(rule.shift.mode === 'off_duty' ? 'off duty only' : 'on duty only');
	}
	if (rule.escalation.enabled) parts.push(`escalates at ${rule.escalation.threshold}`);

	return parts.join(', ');
}
