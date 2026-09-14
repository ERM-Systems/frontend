<script lang="ts">
	import Coffee from '@lucide/svelte/icons/coffee';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import Filters from '$lib/components/panel/Filters.svelte';
	import { elapsed, type Panel } from '$lib/panelClient.svelte';

	let { panel, now }: { panel: Panel; now: number } = $props();

	let query = $state('');
	let type = $state('');

	const typeOptions = $derived([
		{ value: '', label: 'All types' },
		...panel.snapshot.shifts
			.map((shift) => shift.type)
			.filter((name, index, all) => name && all.indexOf(name) === index)
			.map((name) => ({ value: name, label: name }))
	]);

	const shifts = $derived.by(() => {
		const term = query.trim().toLowerCase();

		return panel.snapshot.shifts
			.filter(
				(shift) =>
					(!type || shift.type === type) &&
					(!term ||
						shift.name.toLowerCase().includes(term) ||
						shift.type.toLowerCase().includes(term))
			)
			.toSorted((a, b) => a.startEpoch - b.startEpoch);
	});
</script>

<Filters
	bind:query
	bind:choice={type}
	placeholder="Search staff"
	label="Search staff on duty"
	options={typeOptions}
	choiceLabel="All types"
/>

<ul class="divide-y divide-line">
	{#each shifts as shift (shift.id)}
		<li class="flex items-center gap-4 px-5 py-3.5">
			<Tooltip text={shift.onBreak ? 'On break' : 'Active'}>
				<span
					class="h-2 w-2 shrink-0 rounded-full {shift.onBreak
						? 'bg-yellow-400'
						: 'animate-pulse bg-green-400'}"
				></span>
			</Tooltip>

			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{shift.name}</p>
				{#if shift.breaks}
					<p class="mt-1 truncate text-xs text-muted">
						{shift.breaks} break{shift.breaks === 1 ? '' : 's'}
					</p>
				{/if}
			</div>

			<div class="shrink-0 text-right">
				<p class="text-sm text-muted tabular-nums">{elapsed(now / 1000 - shift.startEpoch)}</p>
				<p class="mt-1 truncate text-xs text-muted">{shift.type}</p>
			</div>

			{#if shift.onBreak}
				<Coffee class="h-4 w-4 shrink-0 text-yellow-400" />
			{/if}
		</li>
	{:else}
		<li class="px-5 py-12 text-center text-sm text-muted">
			{query || type ? 'Nobody on duty matches those filters.' : 'Nobody is on duty right now.'}
		</li>
	{/each}
</ul>
