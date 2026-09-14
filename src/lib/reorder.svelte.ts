class Drag {
	list = $state<unknown[] | null>(null);
	from = $state(-1);
	over = $state(-1);

	reset() {
		this.list = null;
		this.from = -1;
		this.over = -1;
	}
}

export const drag = new Drag();

export function move(list: unknown[], from: number, to: number) {
	if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;

	list.splice(to, 0, list.splice(from, 1)[0]);
}
