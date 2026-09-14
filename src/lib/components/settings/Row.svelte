<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		description,
		wide = false,
		tight = false,
		children
	}: {
		label: string;
		description?: string;
		wide?: boolean;
		tight?: boolean;
		children: Snippet;
	} = $props();
</script>

<div
	class="flex gap-4 px-6 py-4 {wide
		? 'flex-col'
		: 'flex-wrap items-center justify-between sm:flex-nowrap'}"
>
	<div class="min-w-40 flex-1">
		<p class="font-medium">{label}</p>
		{#if description}
			<p class="mt-1 text-sm text-muted">{description}</p>
		{/if}
	</div>

	<div class="{wide ? '' : tight ? 'ml-auto w-auto max-w-full' : 'w-full sm:w-72'} shrink-0">
		{@render children()}
	</div>
</div>
