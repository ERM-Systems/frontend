<script lang="ts">
	import type { Component } from 'svelte';
	import { fade } from 'svelte/transition';

	export interface MenuItem {
		label: string;
		icon: Component;
		href?: string;
		action?: () => void;
		divider?: boolean;
	}

	let {
		x,
		y,
		items,
		close
	}: {
		x: number;
		y: number;
		items: MenuItem[];
		close: () => void;
	} = $props();

	const width = 232;

	const style = $derived(
		[
			`left: ${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`,
			`top: ${Math.max(8, Math.min(y, window.innerHeight - (items.length * 38 + 16)))}px`,
			`width: ${width}px`
		].join('; ')
	);

	function choose(item: MenuItem) {
		item.action?.();
		close();
	}
</script>

<svelte:window
	onkeydown={(event) => event.key === 'Escape' && close()}
	onresize={close}
	onblur={close}
/>

<button
	type="button"
	tabindex="-1"
	aria-label="Close menu"
	onclick={close}
	oncontextmenu={(event) => {
		event.preventDefault();
		close();
	}}
	class="fixed inset-0 z-50 cursor-default"
></button>

<div
	{style}
	transition:fade={{ duration: 90 }}
	class="fixed z-50 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/50"
>
	{#each items as item (item.label)}
		{#if item.divider}
			<span class="my-1.5 block h-px bg-line"></span>
		{/if}

		{#if item.href}
			<a
				href={item.href}
				onclick={close}
				class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-white/8 hover:text-white"
			>
				<item.icon class="h-4 w-4 shrink-0" />
				{item.label}
			</a>
		{:else}
			<button
				type="button"
				onclick={() => choose(item)}
				class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-white/8 hover:text-white"
			>
				<item.icon class="h-4 w-4 shrink-0" />
				{item.label}
			</button>
		{/if}
	{/each}
</div>
