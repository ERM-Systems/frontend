<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { page } from '$app/state';
	import { dashboardPages } from '$lib/dashboard';

	let { description }: { description: string } = $props();

	const current = $derived(
		dashboardPages.find((entry) => entry.slug === (page.url.pathname.split('/')[3] ?? ''))
	);
</script>

{#if current}
	{@const Icon = current.icon}
	<div class="flex items-start gap-4">
		<div
			class="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface sm:flex"
		>
			<Icon class="h-5 w-5" />
		</div>

		<div class="min-w-0 flex-1">
			<p class="flex items-center gap-1 text-xs text-muted">
				{current.group}
				<ChevronRight class="h-3 w-3" />
				{current.label}
			</p>

			<h1 class="mt-1 text-3xl font-bold tracking-[-0.03em]">{current.label}</h1>
			<p class="mt-2 max-w-2xl text-muted">{description}</p>
		</div>
	</div>
{/if}
