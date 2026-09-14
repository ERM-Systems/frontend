<script lang="ts">
	let {
		checked = $bindable(false),
		name,
		label,
		onchange
	}: {
		checked?: boolean;
		name?: string;
		label?: string;
		onchange?: (checked: boolean) => void;
	} = $props();
</script>

<span class="relative inline-flex shrink-0 items-center">
	<input
		type="checkbox"
		role="switch"
		{name}
		aria-label={label}
		autocomplete="off"
		bind:checked
		onchange={(event) => onchange?.(event.currentTarget.checked)}
		class="h-6 w-11 cursor-pointer appearance-none rounded-full border-0 bg-white/12 bg-none transition-colors checked:bg-red-500 checked:bg-none focus:ring-0 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 pointer-coarse:-m-2.5 pointer-coarse:box-content pointer-coarse:border-10 pointer-coarse:border-transparent pointer-coarse:bg-clip-padding"
	/>
	<span
		class="pointer-events-none absolute left-1 h-4 w-4 rounded-full bg-white transition-transform duration-150 {checked
			? 'translate-x-5'
			: ''}"
	></span>
</span>
