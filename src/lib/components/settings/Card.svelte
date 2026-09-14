<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { slide } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	let {
		id,
		title,
		description,
		action,
		collapsible = false,
		open = $bindable(!collapsible),
		children
	}: {
		id?: string;
		title: string;
		description?: string;
		action?: Snippet;
		collapsible?: boolean;
		open?: boolean;
		children: Snippet;
	} = $props();

	const anchor = $derived(
		id ??
			title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
	);

	const shown = $derived(!collapsible || open);
</script>

<section id={anchor} data-toc={title} class="scroll-mt-24 rounded-xl border border-line bg-surface">
	<div
		class="flex flex-wrap items-center gap-4 rounded-t-xl bg-white/2 px-6 py-5 {shown
			? 'border-b border-line'
			: 'rounded-b-xl'}"
	>
		{#if collapsible}
			<button
				type="button"
				onclick={() => (open = !open)}
				aria-expanded={open}
				class="flex min-w-0 flex-1 basis-64 items-center gap-3 text-left"
			>
				<span class="min-w-0 flex-1">
					<span class="block text-sm font-semibold tracking-wide text-white">{title}</span>
					{#if description}
						<span class="mt-1 block text-sm text-muted">{description}</span>
					{/if}
				</span>

				<ChevronDown
					class="h-4 w-4 shrink-0 text-muted transition-transform {open ? 'rotate-180' : ''}"
				/>
			</button>
		{:else}
			<div class="min-w-0 flex-1 basis-64">
				<h2 class="text-sm font-semibold tracking-wide text-white">{title}</h2>
				{#if description}
					<p class="mt-1 text-sm text-muted">{description}</p>
				{/if}
			</div>
		{/if}

		{#if action}
			{@render action()}
		{/if}
	</div>

	{#if shown}
		<div transition:slide={{ duration: 160 }}>
			{@render children()}
		</div>
	{/if}
</section>
