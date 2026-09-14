import { untrack } from 'svelte';

export interface Editable<T> {
	readonly value: T;
	readonly dirty: boolean;
	reset(): void;
	commit(next?: T): void;
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify($state.snapshot(value))) as T;
}

export function editable<T>(read: () => T): Editable<T> {
	const initial = untrack(read);

	let saved = $state(clone(initial));
	let value = $state(clone(initial));

	return {
		get value() {
			return value;
		},
		get dirty() {
			return JSON.stringify($state.snapshot(value)) !== JSON.stringify($state.snapshot(saved));
		},
		reset() {
			value = clone(saved);
		},
		commit(next?: T) {
			saved = clone(next ?? value);
			value = clone(saved);
		}
	};
}

export function minutes(seconds: number): number {
	return Math.round(seconds / 60);
}

export function hours(seconds: number): number {
	return Math.round((seconds / 3600) * 100) / 100;
}
