<script lang="ts">
	import { guildData } from '$lib/dashboardData.svelte';
	import Select from './Select.svelte';

	let {
		value = $bindable(''),
		placeholder = 'No channel',
		types,
		label
	}: { value: string; placeholder?: string; types?: number[]; label?: string } = $props();

	const options = $derived(
		(guildData.channels ?? [])
			.filter((channel) => (types ? types.includes(channel.type) : channel.type !== 2))
			.map((channel) => ({
				value: channel.id,
				label: channel.name,
				prefix: channel.type === 2 ? '' : '#'
			}))
	);
</script>

{#if guildData.channels === undefined}
	<div class="skeleton h-10 rounded-lg bg-white/8"></div>
{:else if guildData.channels === null}
	<p class="text-sm text-muted">Channels are unavailable right now.</p>
{:else}
	<Select {options} bind:value {placeholder} {label} clearable />
{/if}
