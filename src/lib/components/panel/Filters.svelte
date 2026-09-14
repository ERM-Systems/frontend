<script lang="ts">
	import FileText from '@lucide/svelte/icons/file-text';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import Search from '@lucide/svelte/icons/search';
	import DatePicker, { isoDate } from '$lib/components/settings/DatePicker.svelte';
	import Select from '$lib/components/settings/Select.svelte';

	let {
		query = $bindable(''),
		choice = $bindable(''),
		reason = $bindable(''),
		from = $bindable(''),
		to = $bindable(''),
		placeholder,
		label,
		options,
		choiceLabel = 'All',
		reasonPlaceholder = '',
		dates = false
	}: {
		query?: string;
		choice?: string;
		reason?: string;
		from?: string;
		to?: string;
		placeholder: string;
		label: string;
		options?: { value: string; label: string }[];
		choiceLabel?: string;
		reasonPlaceholder?: string;
		dates?: boolean;
	} = $props();

	const today = isoDate();

	const choices = $derived(
		options?.map((option) => (option.value ? option : { ...option, icon: ListFilter }))
	);
</script>

<div class="flex flex-wrap gap-2 border-b border-line px-5 py-4">
	<div
		class="flex min-w-40 flex-1 items-center gap-2 rounded-lg border border-line bg-white/5 px-3"
	>
		<Search class="h-4 w-4 shrink-0 text-muted" />
		<input
			bind:value={query}
			{placeholder}
			aria-label={label}
			autocomplete="off"
			class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
		/>
	</div>

	{#if choices}
		<div class="shrink-0 sm:w-40">
			<Select
				compact
				options={choices}
				bind:value={choice}
				placeholder={choiceLabel}
				label={choice ? undefined : choiceLabel}
			/>
		</div>
	{/if}

	{#if reasonPlaceholder}
		<div
			class="flex min-w-40 flex-1 items-center gap-2 rounded-lg border border-line bg-white/5 px-3"
		>
			<FileText class="h-4 w-4 shrink-0 text-muted" />
			<input
				bind:value={reason}
				placeholder={reasonPlaceholder}
				aria-label={reasonPlaceholder}
				autocomplete="off"
				class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
			/>
		</div>
	{/if}

	{#if dates}
		<div class="flex min-w-40 flex-1 items-center gap-2">
			<div class="min-w-0 flex-1">
				<DatePicker
					bind:value={from}
					label="Punished on or after"
					placeholder="Any date"
					max={today}
					clearable
				/>
			</div>
			<span class="shrink-0 text-xs text-muted">to</span>
			<div class="min-w-0 flex-1">
				<DatePicker
					bind:value={to}
					label="Punished on or before"
					placeholder="Any date"
					max={today}
					clearable
				/>
			</div>
		</div>
	{/if}
</div>
