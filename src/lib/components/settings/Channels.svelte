<script lang="ts">
	import { guildData } from '$lib/dashboardData.svelte';
	import MultiSelect from './MultiSelect.svelte';

	let {
		selected = $bindable([]),
		placeholder = 'No channels',
		label
	}: { selected: string[]; placeholder?: string; label?: string } = $props();

	const options = $derived(
		(guildData.channels ?? []).map((channel) => ({
			value: channel.id,
			label: `#${channel.name}`
		}))
	);
</script>

{#if guildData.channels === undefined}
	<div class="skeleton h-10 rounded-lg bg-white/8"></div>
{:else if guildData.channels === null}
	<p class="text-sm text-muted">Channels are unavailable right now.</p>
{:else}
	<MultiSelect {options} bind:values={selected} {placeholder} {label} />
{/if}
