<script lang="ts">
	import ServerOff from '@lucide/svelte/icons/server-off';
	import type { Shard } from '$lib/server/status';

	let {
		shards,
		highlight = null,
		loading = false
	}: { shards: Shard[]; highlight?: number | null; loading?: boolean } = $props();

	const placeholders: Shard[] = Array.from({ length: 28 }, (_, index) => ({
		id: index,
		ping: 100
	}));

	const tiles = $derived(loading ? placeholders : shards);

	function tone(ping: number) {
		if (ping <= 0 || ping >= 275) return 'border-red-500/40 bg-red-500/15 text-red-300';
		if (ping <= 150) return 'border-green-500/30 bg-green-500/10 text-green-300';
		return 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300';
	}
</script>

{#if !tiles.length}
	<div
		class="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface p-12 text-center"
	>
		<ServerOff class="h-8 w-8 text-muted" />
		<p class="text-muted">Shard data is unavailable right now.</p>
	</div>
{:else}
	<div class="rounded-xl border border-line bg-surface p-4">
		<div
			class="grid auto-rows-14 grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2 sm:auto-rows-19 sm:grid-cols-[repeat(auto-fill,minmax(76px,1fr))]"
		>
			{#each tiles as shard (shard.id)}
				<div
					class="flex flex-col items-center justify-center rounded-lg border transition-all {loading
						? 'skeleton border-line bg-white/5 text-muted'
						: tone(shard.ping)} {highlight === shard.id ? 'scale-105 ring-2 ring-white' : ''}"
				>
					<span class="text-sm font-semibold">{shard.id}</span>
					<span class="mt-0.5 text-[11px] opacity-70">
						{shard.ping > 0 ? `${Math.round(shard.ping)}ms` : 'down'}
					</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
