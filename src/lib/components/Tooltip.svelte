<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';

	let { text, children }: { text: string; children: Snippet } = $props();

	const margin = 8;

	let host = $state<HTMLElement>();
	let tip = $state<HTMLElement>();
	let open = $state(false);
	let anchor = $state({ top: 0, left: 0 });
	let shift = $state(0);
	let below = $state(false);

	const coarse = () => matchMedia('(pointer: coarse)').matches;

	function show() {
		if (!host || !text) return;

		const rect = host.getBoundingClientRect();
		anchor = { top: rect.top - margin, left: rect.left + rect.width / 2 };
		below = false;
		shift = 0;
		open = true;
	}

	$effect(() => {
		if (!open || !tip) return;

		const half = tip.offsetWidth / 2;
		const left = Math.min(Math.max(anchor.left, margin + half), window.innerWidth - margin - half);

		shift = left - anchor.left;
		below = anchor.top - tip.offsetHeight < margin;
	});
</script>

<svelte:window
	onpointerdown={(event) => {
		if (open && coarse() && host && !host.contains(event.target as Node)) open = false;
	}}
/>

<span
	bind:this={host}
	role="presentation"
	onpointerenter={() => !coarse() && show()}
	onpointerleave={() => !coarse() && (open = false)}
	onclick={() => coarse() && (open ? (open = false) : show())}
	onfocusin={() => !coarse() && show()}
	onfocusout={() => !coarse() && (open = false)}
	class="inline-flex"
>
	{@render children()}
</span>

{#if open}
	<span
		bind:this={tip}
		role="tooltip"
		style="top: {below ? anchor.top + margin * 2 : anchor.top}px; left: {anchor.left + shift}px"
		class="pointer-events-none fixed z-100 w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-white shadow-2xl shadow-black/60 {below
			? ''
			: '-translate-y-full'}"
		transition:fade={{ duration: 100 }}
	>
		{text}
	</span>
{/if}
