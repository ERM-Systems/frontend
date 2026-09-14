const menuHeight = 320;
const margin = 16;

function clipper(host: HTMLElement): HTMLElement | null {
	let node = host.parentElement;

	while (node) {
		const style = getComputedStyle(node);
		if (/auto|scroll|hidden/.test(`${style.overflowY} ${style.overflowX}`)) return node;
		node = node.parentElement;
	}

	return null;
}

export function placement(
	host: HTMLElement | undefined,
	desired = menuHeight,
	free = false
): { up: boolean; max: number } {
	if (!host) return { up: false, max: menuHeight };

	const rect = host.getBoundingClientRect();
	const bounds = free ? null : clipper(host)?.getBoundingClientRect();

	const ceiling = Math.max(bounds?.top ?? 0, 0);
	const floor = Math.min(bounds?.bottom ?? window.innerHeight, window.innerHeight);

	const above = Math.max(rect.top - ceiling - margin, 0);
	const below = Math.max(floor - rect.bottom - margin, 0);
	const wanted = Math.min(desired, menuHeight);
	const up = below < wanted && above > below;

	return { up, max: Math.min(menuHeight, up ? above : below) };
}
