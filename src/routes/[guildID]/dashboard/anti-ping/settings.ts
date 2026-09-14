import { bool, group, id, ids, num, text } from '$lib/server/settings';
import {
	antiPingActions,
	antiPingShiftModes,
	maxRuleName,
	maxRules,
	type AntiPing,
	type AntiPingEscalation,
	type AntiPingRule,
	type AntiPingShift
} from '$lib/antiPing';

export type { AntiPing, AntiPingRule } from '$lib/antiPing';

const minThreshold = 2;
const maxThreshold = 20;
const minWindow = 60;
const maxWindow = 86_400;
const maxDuration = 2_419_200;
const maxGrace = 86_400;

function clamp(value: number, low: number, high: number): number {
	return Math.min(high, Math.max(low, Math.round(value)));
}

function choice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
	const found = allowed.find((entry) => entry === value);
	return found ?? fallback;
}

function readEscalation(raw: Record<string, unknown>): AntiPingEscalation {
	return {
		enabled: bool(raw.enabled),
		threshold: clamp(num(raw.threshold, 3), minThreshold, maxThreshold),
		window: clamp(num(raw.window, 600), minWindow, maxWindow),
		action: choice(text(raw.action), antiPingActions, 'timeout'),
		duration: clamp(num(raw.duration, 300), minWindow, maxDuration)
	};
}

function readShift(raw: Record<string, unknown>): AntiPingShift {
	return {
		mode: choice(text(raw.mode), antiPingShiftModes, 'always'),
		grace: clamp(num(raw.grace, 0), 0, maxGrace),
		break_off_duty: bool(raw.break_off_duty)
	};
}

function ruleId(value: unknown, index: number): string {
	const cleaned = text(value)
		.replace(/[^a-zA-Z0-9-]/g, '')
		.slice(0, 64);
	return cleaned || `rule-${index + 1}`;
}

function readRule(raw: Record<string, unknown>, index: number): AntiPingRule {
	return {
		id: ruleId(raw.id, index),
		name: text(raw.name, `Rule ${index + 1}`).slice(0, maxRuleName),
		enabled: raw.enabled === undefined ? true : bool(raw.enabled),
		role: ids(raw.role),
		bypass_role: ids(raw.bypass_role),
		ignored_channels: ids(raw.ignored_channels),
		log_channel: id(raw.log_channel),
		use_hierarchy: bool(raw.use_hierarchy),
		escalation: readEscalation(group(raw, 'escalation')),
		shift: readShift(group(raw, 'shift'))
	};
}

function legacyRule(antiping: Record<string, unknown>): AntiPingRule[] {
	const role = ids(antiping.role);
	if (!role.length) return [];

	return [
		readRule(
			{
				id: 'default',
				name: 'Protected roles',
				enabled: true,
				role,
				bypass_role: antiping.bypass_role,
				ignored_channels: antiping.ignored_channels,
				log_channel: antiping.log_channel,
				use_hierarchy: antiping.use_hierarchy ?? true,
				escalation: group(antiping, 'escalation'),
				shift: group(antiping, 'shift')
			},
			0
		)
	];
}

export function readAntiPing(raw: Record<string, unknown>): AntiPing {
	const antiping = group(raw, 'antiping');
	const stored = Array.isArray(antiping.rules) ? antiping.rules : [];

	const rules = stored
		.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
		.slice(0, maxRules)
		.map(readRule);

	return {
		enabled: bool(antiping.enabled),
		rules: rules.length ? rules : legacyRule(antiping)
	};
}

export function legacyMirror(settings: AntiPing): Record<string, unknown> {
	const first = settings.rules.find((rule) => rule.enabled) ?? settings.rules[0];

	return {
		role: first?.role ?? [],
		bypass_role: first?.bypass_role ?? [],
		use_hierarchy: first?.use_hierarchy ?? false,
		ignored_channels: first?.ignored_channels ?? [],
		log_channel: first?.log_channel ?? '',
		escalation: first?.escalation ?? readEscalation({}),
		shift: first?.shift ?? readShift({})
	};
}
