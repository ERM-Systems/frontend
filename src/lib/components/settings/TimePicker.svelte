<script lang="ts">
	import Select from './Select.svelte';

	let {
		value = $bindable(''),
		placeholder = 'Select a time',
		step = 5
	}: {
		value: string;
		placeholder?: string;
		step?: number;
	} = $props();

	const options = $derived.by(() => {
		const entries: { value: string; label: string }[] = [];

		for (let minutes = 0; minutes < 1440; minutes += step) {
			const hour = `${Math.floor(minutes / 60)}`.padStart(2, '0');
			const minute = `${minutes % 60}`.padStart(2, '0');
			entries.push({ value: `${hour}:${minute}`, label: `${hour}:${minute}` });
		}

		if (value && !entries.some((entry) => entry.value === value)) {
			entries.push({ value, label: value });
			entries.sort((a, b) => a.value.localeCompare(b.value));
		}

		return entries;
	});
</script>

<Select {options} bind:value {placeholder} mono />
