<script lang="ts">
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import type { Component, Snippet } from 'svelte';

	let {
		title,
		icon,
		hint,
		drag,
		actions,
		grow = false,
		loading = false,
		onheight,
		children
	}: {
		title: string;
		icon?: Component;
		hint?: string;
		drag?: { start: (event: DragEvent) => void; step: (delta: number) => void };
		actions?: Snippet;
		grow?: boolean;
		loading?: boolean;
		onheight?: (height: number) => void;
		children: Snippet;
	} = $props();

	const Icon = $derived(icon);
	const border = 2;
	const placeholders = [92, 74, 84, 62, 78];

	let root = $state<HTMLElement>();
	let head = $state<HTMLElement>();
	let content = $state<HTMLElement>();

	function lift(event: DragEvent) {
		if (!drag) return;

		if (root && event.dataTransfer) {
			const box = root.getBoundingClientRect();
			event.dataTransfer.setDragImage(root, event.clientX - box.left, event.clientY - box.top);
		}

		drag.start(event);
	}

	$effect(() => {
		const box = content;
		const top = head;
		if (!box || !top || !onheight) return;

		const observer = new ResizeObserver(() =>
			onheight(top.offsetHeight + box.offsetHeight + border)
		);

		observer.observe(box);
		return () => observer.disconnect();
	});
</script>

<section
	bind:this={root}
	class="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface"
>
	<header
		bind:this={head}
		role={drag ? 'toolbar' : undefined}
		aria-label={drag ? `${title} panel` : undefined}
		draggable={!!drag}
		ondragstart={lift}
		class="no-scrollbar flex shrink-0 items-center gap-2.5 overflow-x-auto border-b border-line px-5 py-4 {drag
			? 'cursor-grab select-none active:cursor-grabbing'
			: ''}"
	>
		{#if drag}
			<button
				type="button"
				onkeydown={(event) => {
					if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') drag.step(-1);
					if (event.key === 'ArrowRight' || event.key === 'ArrowDown') drag.step(1);
				}}
				aria-label="Move the {title} panel"
				class="-ml-2 flex shrink-0 cursor-grab items-center justify-center rounded-lg p-1 text-muted transition-colors hover:bg-white/8 hover:text-white active:cursor-grabbing pointer-coarse:p-3.5"
			>
				<GripVertical class="block h-4 w-4" />
			</button>
		{:else if Icon}
			<Icon class="block h-4 w-4 shrink-0 text-muted" />
		{/if}

		<h2 class="min-w-11 truncate text-sm font-semibold">{title}</h2>

		{#if hint}
			<span class="hidden min-w-0 truncate text-xs text-muted sm:block">{hint}</span>
		{/if}

		{#if actions}
			<div class="ml-auto flex shrink-0 items-center">
				{@render actions()}
			</div>
		{/if}
	</header>

	<div class="min-h-0 flex-1 scrollbar-gutter-stable overflow-y-auto">
		{#if loading}
			<div class="skeleton flex flex-col gap-3 px-5 py-4" aria-hidden="true">
				{#each placeholders as width, row (row)}
					<div class="h-4 rounded-md bg-white/10" style="width: {width}%"></div>
				{/each}
			</div>
		{:else if grow}
			<div bind:this={content} class="settled">
				{@render children()}
			</div>
		{:else}
			<div class="settled">
				{@render children()}
			</div>
		{/if}
	</div>
</section>
