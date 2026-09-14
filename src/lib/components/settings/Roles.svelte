<script lang="ts">
	import { guildData } from '$lib/dashboardData.svelte';
	import RoleSelect from './RoleSelect.svelte';

	let {
		selected = $bindable([]),
		placeholder = 'No roles',
		single = false,
		onchange,
		label
	}: {
		selected: string[];
		placeholder?: string;
		single?: boolean;
		onchange?: (selected: string[]) => void;
		label?: string;
	} = $props();
</script>

{#if guildData.roles === undefined}
	<div class="skeleton h-10 rounded-lg bg-white/8"></div>
{:else if guildData.roles === null}
	<p class="text-sm text-muted">Roles are unavailable right now.</p>
{:else}
	<RoleSelect roles={guildData.roles} bind:selected {placeholder} {single} {onchange} {label} />
{/if}
