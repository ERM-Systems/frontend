<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';

	let {
		value = $bindable(),
		type = 'text',
		placeholder = '',
		min,
		max,
		maxlength,
		rows = 0,
		suffix = '',
		label,
		invalid = false,
		describedBy
	}: {
		value: string | number;
		type?: 'text' | 'number' | 'password';
		placeholder?: string;
		min?: number;
		max?: number;
		maxlength?: number;
		rows?: number;
		suffix?: string;
		label?: string;
		invalid?: boolean;
		describedBy?: string;
	} = $props();

	const shell =
		'min-h-10 w-full rounded-lg border border-line bg-white/5 pointer-coarse:min-h-11 px-3 py-2 text-sm pointer-coarse:min-h-11 pointer-coarse:min-h-11 placeholder:text-muted focus:border-white/25 focus:ring-0';

	const bare =
		'[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

	function step(direction: number) {
		const current = Number(value);
		const next = (Number.isFinite(current) ? current : 0) + direction;

		if (min !== undefined && next < min) return;
		if (max !== undefined && next > max) return;

		value = next;
	}
</script>

{#if rows}
	<textarea
		bind:value
		{placeholder}
		{rows}
		{maxlength}
		aria-label={label}
		aria-invalid={invalid}
		aria-describedby={describedBy}
		autocomplete="off"
		class={shell}></textarea>
{:else if type === 'number'}
	<div class="relative">
		<input
			type="number"
			bind:value
			{placeholder}
			{min}
			{max}
			aria-label={label}
			aria-invalid={invalid}
			aria-describedby={describedBy}
			autocomplete="off"
			class="{shell} {bare} {suffix ? 'pr-26 pointer-coarse:pr-18' : 'pr-11 pointer-coarse:pr-3'}"
		/>

		{#if suffix}
			<span
				class="absolute inset-y-0 right-11 flex items-center text-xs text-muted pointer-coarse:right-3"
				>{suffix}</span
			>
		{/if}

		<div class="absolute inset-y-1 right-1 flex w-8 flex-col gap-px pointer-coarse:hidden">
			<button
				type="button"
				onclick={() => step(1)}
				tabindex="-1"
				aria-label="Increase"
				class="flex flex-1 items-center justify-center rounded-t-md text-muted transition-colors hover:bg-white/10 hover:text-white"
			>
				<ChevronUp class="h-3.5 w-3.5" />
			</button>
			<button
				type="button"
				onclick={() => step(-1)}
				tabindex="-1"
				aria-label="Decrease"
				class="flex flex-1 items-center justify-center rounded-b-md text-muted transition-colors hover:bg-white/10 hover:text-white"
			>
				<ChevronDown class="h-3.5 w-3.5" />
			</button>
		</div>
	</div>
{:else if type === 'password'}
	<input
		type="password"
		bind:value
		{placeholder}
		{maxlength}
		aria-label={label}
		aria-invalid={invalid}
		aria-describedby={describedBy}
		autocomplete="off"
		class={shell}
	/>
{:else}
	<input
		type="text"
		bind:value
		{placeholder}
		{maxlength}
		aria-label={label}
		aria-invalid={invalid}
		aria-describedby={describedBy}
		autocomplete="off"
		class={shell}
	/>
{/if}
