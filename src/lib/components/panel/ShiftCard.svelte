<script lang="ts">
	import Coffee from '@lucide/svelte/icons/coffee';
	import History from '@lucide/svelte/icons/history';
	import Play from '@lucide/svelte/icons/play';
	import Square from '@lucide/svelte/icons/square';
	import Select from '$lib/components/settings/Select.svelte';
	import ShiftHistory from '$lib/components/panel/ShiftHistory.svelte';
	import { elapsed, type Panel } from '$lib/panelClient.svelte';

	let { panel, now, shiftTypes }: { panel: Panel; now: number; shiftTypes: string[] } = $props();

	const types = $derived(shiftTypes.length ? shiftTypes : ['Default']);
	let type = $state('');
	let viewing = $state(false);

	$effect(() => {
		if (!type && types.length) type = types[0];
	});

	const options = $derived(types.map((name) => ({ value: name, label: name })));

	const shift = $derived(panel.snapshot.myShift);
	const running = $derived(shift ? now / 1000 - shift.startEpoch : 0);

	const week = $derived.by(() => {
		const cutoff = Math.floor(now / 1000) - 7 * 86_400;

		return panel.snapshot.myHistory
			.filter((entry) => entry.endEpoch >= cutoff)
			.reduce((sum, entry) => sum + Math.max(0, entry.endEpoch - entry.startEpoch), 0);
	});
</script>

<div class="flex h-full flex-col gap-3 px-5 py-4" class:justify-center={!shift}>
	<div class="flex items-center gap-3" class:justify-center={!shift}>
		{#if shift}
			<span
				class="h-2 w-2 shrink-0 rounded-full {shift.onBreak
					? 'bg-yellow-400'
					: 'animate-pulse bg-green-400'}"
			></span>
		{/if}

		<div class="min-w-0 {shift ? 'flex-1' : 'text-center'}">
			<p class="text-sm font-semibold">
				{#if shift}
					{shift.onBreak ? 'On break' : 'On duty'} - {shift.type}
				{:else}
					You are off duty
				{/if}
			</p>
			<p class="mt-0.5 text-xs text-muted">{elapsed(week)} in the last 7 days</p>
		</div>

		{#if shift}
			<span class="shrink-0 text-xl font-bold tracking-tight tabular-nums">{elapsed(running)}</span>
		{/if}
	</div>

	{#if shift}
		<div class="flex gap-2">
			<button
				type="button"
				disabled={!!panel.pending}
				onclick={() => panel.act('break', { action: 'shift.break', id: shift.id })}
				class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50 pointer-coarse:py-3"
			>
				<Coffee class="h-4 w-4" />
				{shift.onBreak ? 'Resume' : 'Break'}
			</button>

			<button
				type="button"
				disabled={!!panel.pending}
				onclick={() => panel.act('end', { action: 'shift.end', id: shift.id })}
				class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 pointer-coarse:py-3"
			>
				<Square class="h-4 w-4" />
				End
			</button>
		</div>
	{:else}
		<div class="flex gap-2">
			<div class="min-w-0 flex-1">
				<Select {options} bind:value={type} placeholder="Shift type" />
			</div>

			<button
				type="button"
				disabled={!!panel.pending}
				onclick={() => panel.act('start', { action: 'shift.start', type })}
				class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:opacity-50 pointer-coarse:py-3"
			>
				<Play class="h-4 w-4" />
				Start
			</button>
		</div>
	{/if}

	<button
		type="button"
		onclick={() => (viewing = true)}
		class="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3.5"
	>
		<History class="h-3.5 w-3.5" />
		View Shifts
	</button>
</div>

{#if viewing}
	<ShiftHistory {panel} close={() => (viewing = false)} />
{/if}
