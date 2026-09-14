import { untrack } from 'svelte';

export interface Counter {
	readonly current: number;
}

export function counter(read: () => number, duration = 700): Counter {
	let value = $state(untrack(read));

	$effect(() => {
		const target = read();
		const from = untrack(() => value);
		if (from === target) return;

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			value = target;
			return;
		}

		let frame = 0;
		const started = performance.now();

		const step = (time: number) => {
			const progress = Math.min(1, (time - started) / duration);
			value = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
			if (progress < 1) frame = requestAnimationFrame(step);
		};

		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});

	return {
		get current() {
			return value;
		}
	};
}
