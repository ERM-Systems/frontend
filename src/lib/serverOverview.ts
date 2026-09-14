export interface OverviewPanels {
	players: boolean;
	teams: boolean;
	activity: boolean;
	vehicles: boolean;
	moderations: boolean;
	priorities: boolean;
}

export interface OverviewLink {
	label: string;
	url: string;
}

export interface OverviewSettings {
	enabled: boolean;
	tagline: string;
	accent: string;
	banner: string;
	join_button: boolean;
	links: OverviewLink[];
	panels: OverviewPanels;
}

export const panelNames: { key: keyof OverviewPanels; label: string; description: string }[] = [
	{
		key: 'players',
		label: 'Player List',
		description: 'Everyone in the server right now, with their team and permission.'
	},
	{
		key: 'teams',
		label: 'Team Split',
		description: 'How your players are spread across the teams.'
	},
	{
		key: 'activity',
		label: 'Join Activity',
		description: 'A running feed of who joined and left.'
	},
	{
		key: 'vehicles',
		label: 'Vehicles',
		description: 'Vehicles currently spawned, with their owner.'
	},
	{
		key: 'moderations',
		label: 'Your Record',
		description:
			'Lets a signed-in player view the moderations issued against them, on the overview and on their own logs page.'
	},
	{
		key: 'priorities',
		label: 'Priority Requests',
		description: 'Links members to the page where they can ask your staff team for a priority.'
	}
];

export const accents = [
	{ value: '#f03232', label: 'Red' },
	{ value: '#f97316', label: 'Orange' },
	{ value: '#eab308', label: 'Amber' },
	{ value: '#22c55e', label: 'Green' },
	{ value: '#06b6d4', label: 'Cyan' },
	{ value: '#3b82f6', label: 'Blue' },
	{ value: '#8b5cf6', label: 'Violet' },
	{ value: '#ec4899', label: 'Pink' },
	{ value: '#8b8b8b', label: 'Grey' }
];

export const defaultAccent = accents[0].value;
export const taglineLimit = 160;
export const linkLimit = 4;
export const linkLabelLimit = 24;
export const urlLimit = 400;

export function validUrl(value: string): boolean {
	if (!value || value.length > urlLimit) return false;

	try {
		return new URL(value).protocol === 'https:';
	} catch {
		return false;
	}
}

export function validAccent(value: string): boolean {
	return /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeAccent(input: string): string {
	const hex = input.trim().replace(/^#/, '').toLowerCase();
	const full = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;

	return validAccent(`#${full}`) ? `#${full}` : '';
}

export interface Hsv {
	h: number;
	s: number;
	v: number;
}

export function hexToHsv(hex: string): Hsv {
	const int = parseInt((normalizeAccent(hex) || '#000000').slice(1), 16);
	const r = ((int >> 16) & 255) / 255;
	const g = ((int >> 8) & 255) / 255;
	const b = (int & 255) / 255;

	const max = Math.max(r, g, b);
	const span = max - Math.min(r, g, b);

	let h = 0;
	if (span) {
		if (max === r) h = ((g - b) / span + (g < b ? 6 : 0)) / 6;
		else if (max === g) h = ((b - r) / span + 2) / 6;
		else h = ((r - g) / span + 4) / 6;
	}

	return { h, s: max ? span / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
	const channel = (offset: number) => {
		const k = (offset + h * 6) % 6;
		const level = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
		return Math.round(level * 255)
			.toString(16)
			.padStart(2, '0');
	};

	return `#${channel(5)}${channel(3)}${channel(1)}`;
}

export type ColorFormat = 'hex' | 'rgb' | 'hsl';

export const colorFormats: ColorFormat[] = ['hex', 'rgb', 'hsl'];

function channels(hex: string): [number, number, number] {
	const value = parseInt((normalizeAccent(hex) || '#000000').slice(1), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function formatAccent(hex: string, format: ColorFormat): string {
	if (format === 'hex') return (normalizeAccent(hex) || '#000000').toUpperCase();

	const [r, g, b] = channels(hex);
	if (format === 'rgb') return `${r}, ${g}, ${b}`;

	const { h, s, v } = hexToHsv(hex);
	const light = v - (v * s) / 2;
	const saturation = light === 0 || light === 1 ? 0 : (v - light) / Math.min(light, 1 - light);

	return `${Math.round(h * 360)}, ${Math.round(saturation * 100)}%, ${Math.round(light * 100)}%`;
}

export function parseAccent(input: string, format: ColorFormat): string {
	const direct = normalizeAccent(input);
	if (direct) return direct;

	const parts = input.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
	if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return '';

	if (format === 'rgb') {
		if (parts.some((part) => part < 0 || part > 255)) return '';
		const [r, g, b] = parts;
		return `#${[r, g, b].map((part) => Math.round(part).toString(16).padStart(2, '0')).join('')}`;
	}

	if (format === 'hsl') {
		const [hue, saturation, light] = [parts[0] / 360, parts[1] / 100, parts[2] / 100];
		if (saturation < 0 || saturation > 1 || light < 0 || light > 1) return '';

		const v = light + saturation * Math.min(light, 1 - light);
		return hsvToHex({ h: ((hue % 1) + 1) % 1, s: v ? 2 - (2 * light) / v : 0, v });
	}

	return '';
}

export function tint(accent: string, alpha: number): string {
	const hex = validAccent(accent) ? accent : defaultAccent;
	const value = parseInt(hex.slice(1), 16);

	return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
