export function utm(href: string, medium: string): string {
	if (href.startsWith('#')) return href;

	const hash = href.indexOf('#');
	const path = hash === -1 ? href : href.slice(0, hash);
	const fragment = hash === -1 ? '' : href.slice(hash);

	return `${path}${path.includes('?') ? '&' : '?'}utm_source=ermbot&utm_medium=${medium}${fragment}`;
}
