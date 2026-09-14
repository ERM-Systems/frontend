import { browser } from '$app/environment';

export const modLabel = browser && /mac/i.test(navigator.userAgent) ? '⌘' : 'Ctrl';

export const shortcuts: { keys: string[]; label: string }[] = [
	{ keys: [modLabel, 'K'], label: 'Open the command menu' },
	{ keys: [modLabel, ','], label: 'Open your settings' },
	{ keys: [modLabel, 'G'], label: 'Go to your servers' },
	{ keys: ['/'], label: 'Search from the command menu' },
	{ keys: ['Esc'], label: 'Close menus and dialogs' }
];
