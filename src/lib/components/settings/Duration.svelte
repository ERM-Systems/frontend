<script lang="ts">
	import { untrack } from 'svelte';
	import Input from './Input.svelte';
	import Select from './Select.svelte';

	let {
		seconds = $bindable(0),
		units = ['minutes', 'hours'],
		min = 0,
		label
	}: { seconds: number; units?: string[]; min?: number; label?: string } = $props();

	const factors: Record<string, number> = {
		seconds: 1,
		minutes: 60,
		hours: 3600,
		days: 86_400
	};

	const options = untrack(() => units).map((unit) => ({
		value: unit,
		label: unit[0].toUpperCase() + unit.slice(1)
	}));

	function best(total: number): string {
		const ordered = [...units].sort((a, b) => factors[b] - factors[a]);
		return ordered.find((unit) => total && total % factors[unit] === 0) ?? units[0];
	}

	let unit = $state(untrack(() => best(seconds)));

	const amount = $derived(Math.round((seconds / factors[unit]) * 100) / 100);

	function update(next: string | number) {
		const value = Number(next);
		seconds = Number.isFinite(value) ? Math.max(min, Math.round(value * factors[unit])) : min;
	}
</script>

<div class="flex gap-2">
	<div class="min-w-0 flex-1">
		<Input type="number" min={0} {label} bind:value={() => amount, update} />
	</div>

	<div class="w-32 shrink-0">
		<Select {options} bind:value={unit} label={label ? `${label} unit` : undefined} />
	</div>
</div>
