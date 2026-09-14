<script lang="ts">
	import Coffee from '@lucide/svelte/icons/coffee';
	import X from '@lucide/svelte/icons/x';
	import { fade, scale } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import Pager from '$lib/components/Pager.svelte';
	import { elapsed, stamp, type Panel } from '$lib/panelClient.svelte';
	import { pageSlice } from '$lib/staff';

	let { panel, close }: { panel: Panel; close: () => void } = $props();

	const perPage = 12;
	let page = $state(1);

	const history = $derived(panel.snapshot.myHistory);
	const shown = $derived(pageSlice(history, page, perPage));

	const total = $derived(
		history.reduce((sum, entry) => sum + Math.max(0, entry.endEpoch - entry.startEpoch), 0)
	);
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && close()} />

<div use:portal class="fixed inset-0 z-60 flex items-center justify-center p-4">
	<button
		type="button"
		aria-label="Close the shift history"
		onclick={close}
		class="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
		transition:fade={{ duration: 140 }}
	></button>

	<div
		class="relative flex max-h-full w-full max-w-150 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/60"
		transition:scale={{ duration: 160, start: 0.97 }}
	>
		<header class="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
			<div class="min-w-0 flex-1">
				<h2 class="truncate text-base font-semibold">My shifts</h2>
				<p class="mt-0.5 truncate text-xs text-muted">
					{history.length} logged - {elapsed(total)} in total
				</p>
			</div>

			<button
				type="button"
				onclick={close}
				aria-label="Close the shift history"
				class="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-white/8 hover:text-white"
			>
				<X class="h-4 w-4" />
			</button>
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto">
			<ul class="divide-y divide-line">
				{#each shown as entry (entry.id)}
					<li class="flex items-center gap-4 px-5 py-3.5">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{entry.type}</p>
							<p class="mt-0.5 truncate text-xs text-muted">{stamp(entry.endEpoch)}</p>
						</div>

						{#if entry.breaks}
							<span
								class="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted"
							>
								<Coffee class="h-3 w-3" />
								{entry.breaks}
							</span>
						{/if}

						<span class="shrink-0 text-sm font-semibold tabular-nums">
							{elapsed(entry.endEpoch - entry.startEpoch)}
						</span>
					</li>
				{:else}
					<li class="px-5 py-12 text-center text-sm text-muted">No shifts logged yet.</li>
				{/each}
			</ul>
		</div>

		<Pager total={history.length} {perPage} bind:page label="shifts" />
	</div>
</div>
