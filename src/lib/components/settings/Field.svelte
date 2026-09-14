<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		description,
		counter,
		wide = false,
		children
	}: {
		label: string;
		description?: string;
		counter?: string;
		wide?: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="flex flex-col {wide ? 'sm:col-span-2' : ''}">
	<p class="flex items-center justify-between gap-2 text-sm font-medium">
		<span class="min-w-0 truncate">{label}</span>
		{#if counter}
			<span class="shrink-0 text-xs font-normal text-muted">{counter}</span>
		{/if}
	</p>
	{#if description}
		<p class="mt-1 text-sm text-muted">{description}</p>
	{/if}

	<div class="mt-auto pt-2">
		{@render children()}
	</div>
</div>
