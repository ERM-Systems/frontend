<script lang="ts">
	import Filters from '$lib/components/panel/Filters.svelte';
	import type { Panel } from '$lib/panelClient.svelte';

	let { panel }: { panel: Panel } = $props();

	let query = $state('');
	let livery = $state('');
	let restrictions = $state<string[]>([]);

	const restricted = $derived(new Set(restrictions.map((name) => name.toLowerCase())));

	$effect(() => {
		fetch(`${panel.base}?feed=restricted`)
			.then((response) => (response.ok ? response.json() : []))
			.then((value: string[]) => (restrictions = value))
			.catch(() => (restrictions = []));
	});

	const liveryOptions = $derived([
		{ value: '', label: 'All liveries' },
		...panel.snapshot.server.vehicles
			.map((vehicle) => vehicle.texture)
			.filter((texture, index, all) => texture && all.indexOf(texture) === index)
			.map((texture) => ({ value: texture, label: texture }))
	]);

	const vehicles = $derived.by(() => {
		const term = query.trim().toLowerCase();

		return panel.snapshot.server.vehicles
			.filter(
				(vehicle) =>
					(!livery || vehicle.texture === livery) &&
					(!term ||
						vehicle.name.toLowerCase().includes(term) ||
						vehicle.owner.toLowerCase().includes(term))
			)
			.toSorted(
				(a, b) =>
					Number(restricted.has(b.name.toLowerCase())) -
					Number(restricted.has(a.name.toLowerCase()))
			);
	});
</script>

<Filters
	bind:query
	bind:choice={livery}
	placeholder="Search vehicles"
	label="Search vehicles"
	options={liveryOptions}
	choiceLabel="All liveries"
/>

<ul class="divide-y divide-line">
	{#each vehicles as vehicle (vehicle.owner + vehicle.name)}
		<li class="px-5 py-3.5">
			<div class="flex items-center gap-2">
				<p class="min-w-0 flex-1 truncate text-sm font-medium">{vehicle.name}</p>

				{#if restricted.has(vehicle.name.toLowerCase())}
					<span
						class="shrink-0 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-medium text-red-300"
					>
						Restricted
					</span>
				{/if}
			</div>

			<p class="mt-1 truncate text-xs text-muted">
				{vehicle.owner}{vehicle.texture ? ` - ${vehicle.texture}` : ''}
			</p>
		</li>
	{:else}
		<li class="px-5 py-12 text-center text-sm text-muted">
			{query || livery ? 'No vehicles match those filters.' : 'No vehicles are spawned right now.'}
		</li>
	{/each}
</ul>
