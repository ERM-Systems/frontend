export interface Theme {
	id: string;
	name: string;
	swatch: { bg: string; surface: string };
}

export const themes: Theme[] = [
	{ id: 'midnight', name: 'Midnight', swatch: { bg: '#050505', surface: '#1e1e1e' } },
	{ id: 'carbon', name: 'Carbon', swatch: { bg: '#0e1013', surface: '#262b33' } },
	{ id: 'slate', name: 'Slate', swatch: { bg: '#0b0d10', surface: '#232b38' } },
	{ id: 'crimson', name: 'Crimson', swatch: { bg: '#0b0506', surface: '#2e1418' } },
	{ id: 'ember', name: 'Ember', swatch: { bg: '#0d0704', surface: '#33200f' } },
	{ id: 'blossom', name: 'Blossom', swatch: { bg: '#0b0408', surface: '#2f1426' } },
	{ id: 'amethyst', name: 'Amethyst', swatch: { bg: '#07050b', surface: '#221733' } },
	{ id: 'ocean', name: 'Ocean', swatch: { bg: '#040709', surface: '#172532' } },
	{ id: 'lagoon', name: 'Lagoon', swatch: { bg: '#03090a', surface: '#0f2a2e' } },
	{ id: 'forest', name: 'Forest', swatch: { bg: '#040806', surface: '#14291f' } },
	{ id: 'mocha', name: 'Mocha', swatch: { bg: '#0a0705', surface: '#291f15' } },
	{ id: 'daylight', name: 'Daylight', swatch: { bg: '#f4f5f7', surface: '#d9dde3' } },
	{ id: 'frost', name: 'Frost', swatch: { bg: '#eef3f8', surface: '#d3dde8' } },
	{ id: 'blush', name: 'Blush', swatch: { bg: '#faf0f5', surface: '#ecd6e2' } },
	{ id: 'sand', name: 'Sand', swatch: { bg: '#f6f3ee', surface: '#e2dbd0' } }
];

export const defaultTheme = 'midnight';
export const themeKey = 'erm:theme';

export const theme = $state({ id: defaultTheme });

export function isTheme(value: unknown): boolean {
	return themes.some((entry) => entry.id === value);
}

export function loadTheme() {
	let stored: string | null;
	try {
		stored = localStorage.getItem(themeKey);
	} catch {
		stored = null;
	}

	theme.id = isTheme(stored) ? (stored as string) : defaultTheme;
	applyTheme(theme.id);
}

export function applyTheme(id: string) {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.theme = isTheme(id) ? id : defaultTheme;
}

export function setTheme(id: string) {
	if (!isTheme(id)) return;

	theme.id = id;
	applyTheme(id);

	try {
		localStorage.setItem(themeKey, id);
	} catch {
		return;
	}
}
