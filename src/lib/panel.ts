import { browser } from '$app/environment';
import type { ModerationDetail } from './server/panel';

export const discordFallbackAvatar = 'https://cdn.discordapp.com/embed/avatars/0.png';

export const moderationDetails = new Map<string, ModerationDetail>();

export const paneIds = ['server', 'punish', 'logs', 'shift', 'tabs'] as const;

export type PaneId = (typeof paneIds)[number];

export interface Layout {
	right: number;
	order: PaneId[];
	sizes: Record<PaneId, number>;
}

export const paneLabels: Record<PaneId, string> = {
	logs: 'Logs',
	server: 'Server',
	punish: 'New Moderation',
	tabs: 'Player tools',
	shift: 'My Shift'
};

export const paneViewKeys = {
	logs: 'LogView',
	server: 'ERLCView',
	punish: 'ModView',
	tabs: 'StaffView',
	shift: 'ShiftView'
} as const;

export type Views = Record<PaneId, boolean>;

export function allVisible(): Views {
	return { logs: true, server: true, punish: true, tabs: true, shift: true };
}

export const layoutKey = 'panelLayout';

export const defaults: Layout = {
	right: 25,
	order: [...paneIds],
	sizes: { logs: 26, server: 26, punish: 50, tabs: 25, shift: 22 }
};

const sizeLimits = { min: 12, max: 70 };
const rightLimits = { min: 18, max: 40 };
const centreMin = 26;

function bound(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;

	return Math.min(max, Math.max(min, Math.round(value * 10) / 10));
}

function boundOrder(value: unknown): PaneId[] {
	if (!Array.isArray(value) || value.length !== paneIds.length) return [...paneIds];

	const seen = new Set(value);
	if (seen.size !== paneIds.length || paneIds.some((id) => !seen.has(id))) return [...paneIds];

	return value as PaneId[];
}

export function clampLayout(value: unknown): Layout {
	const stored = (value ?? {}) as Partial<Layout>;
	const order = boundOrder(stored.order);
	const stack = (stored.sizes ?? {}) as Record<string, unknown>;

	const sizes = {} as Record<PaneId, number>;
	for (const id of paneIds) {
		sizes[id] = bound(stack[id], defaults.sizes[id], sizeLimits.min, sizeLimits.max);
	}

	let right = bound(stored.right, defaults.right, rightLimits.min, rightLimits.max);

	const left = sizes[order[0]];
	const sides = left + right;

	if (sides > 100 - centreMin) {
		const scale = (100 - centreMin) / sides;
		sizes[order[0]] = Math.max(sizeLimits.min, Math.round(left * scale * 10) / 10);
		right = Math.max(rightLimits.min, Math.round(right * scale * 10) / 10);
	}

	return { right, order, sizes };
}

export function swapPanes(layout: Layout, from: number, to: number): Layout {
	if (from < 0 || to < 0 || from === to) return layout;

	const order = [...layout.order];

	order[from] = layout.order[to];
	order[to] = layout.order[from];

	return { ...layout, order };
}

export function parseLayout(raw: string | undefined): Layout {
	try {
		return clampLayout(JSON.parse(decodeURIComponent(raw ?? '') || 'null'));
	} catch {
		return clampLayout(null);
	}
}

const layoutMaxAge = 60 * 60 * 24 * 365;

export function writeLayout(layout: Layout) {
	const value = encodeURIComponent(JSON.stringify(layout));
	document.cookie = `${layoutKey}=${value}; path=/; max-age=${layoutMaxAge}; samesite=lax`;
}

const alertKey = 'panelDesktopAlerts';

export function alertsSupported(): boolean {
	return browser && 'Notification' in window;
}

export function alertsEnabled(): boolean {
	if (!alertsSupported() || Notification.permission !== 'granted') return false;

	try {
		return localStorage.getItem(alertKey) === '1';
	} catch {
		return false;
	}
}

export async function enableAlerts(): Promise<boolean> {
	if (!alertsSupported()) return false;

	const permission =
		Notification.permission === 'default'
			? await Notification.requestPermission()
			: Notification.permission;
	if (permission !== 'granted') return false;

	try {
		localStorage.setItem(alertKey, '1');
	} catch {
		return false;
	}

	return true;
}

export function disableAlerts() {
	try {
		localStorage.setItem(alertKey, '0');
	} catch {
		return;
	}
}

export function pushAlert(title: string, body: string) {
	if (!alertsSupported() || (!document.hidden && document.hasFocus())) return;

	try {
		const notification = new Notification(title, { body, tag: 'erm-panel' });
		notification.onclick = () => {
			window.focus();
			notification.close();
		};
	} catch {
		return;
	}
}
