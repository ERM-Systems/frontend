const key = 'navbar';

export const navbar = $state({ floating: false });

export function loadNavbar() {
	try {
		navbar.floating = localStorage.getItem(key) === 'floating';
	} catch {
		navbar.floating = false;
	}
}

export function setNavbar(floating: boolean) {
	navbar.floating = floating;

	try {
		localStorage.setItem(key, floating ? 'floating' : 'attached');
	} catch {
		return;
	}
}
