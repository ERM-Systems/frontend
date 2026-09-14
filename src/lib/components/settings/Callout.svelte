<script lang="ts">
	import Info from '@lucide/svelte/icons/info';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { Snippet } from 'svelte';

	let {
		tone = 'info',
		children
	}: {
		tone?: 'info' | 'warning';
		children: Snippet;
	} = $props();
</script>

<p class="flex items-start gap-2 border-t border-line px-6 py-4 text-sm text-muted">
	{#if tone === 'warning'}
		<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
	{:else}
		<Info class="mt-0.5 h-4 w-4 shrink-0 text-muted" />
	{/if}

	<span class="min-w-0 flex-1">{@render children()}</span>
</p>
