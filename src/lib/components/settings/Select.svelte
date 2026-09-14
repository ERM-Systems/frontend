<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { fly } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import { placement } from '$lib/dropdown';

	export interface Option {
		value: string;
		label: string;
		prefix?: string;
		color?: number;
		iconUrl?: string;
		hint?: string;
		group?: string;
		icon?: typeof Check;
	}

	let {
		options,
		value = $bindable(''),
		placeholder = 'Select an option',
		clearable = false,
		compact = false,
		mono = false,
		disabled = false,
		onchange,
		label,
		describedBy
	}: {
		options: Option[];
		value: string;
		placeholder?: string;
		clearable?: boolean;
		compact?: boolean;
		mono?: boolean;
		disabled?: boolean;
		onchange?: (value: string) => void;
		label?: string;
		describedBy?: string;
	} = $props();

	let open = $state(false);
	let query = $state('');
	let host = $state<HTMLElement>();
	let menu = $state<HTMLElement>();
	let list = $state<HTMLElement>();
	let place = $state({ up: false, max: 320 });
	let rect = $state({ left: 0, width: 0, above: 0, below: 0 });

	const optionHeight = 32;
	const searchHeight = 32;
	const headerHeight = 28;
	const listPadding = 8;

	function anchor() {
		if (!host) return;

		const box = host.getBoundingClientRect();

		rect = {
			left: box.left,
			width: box.width,
			above: window.innerHeight - box.top,
			below: box.bottom
		};
	}

	function toggle_() {
		if (!open) {
			const groups = new Set(options.map((option) => option.group).filter(Boolean)).size;
			const wanted =
				options.length * optionHeight +
				groups * headerHeight +
				listPadding +
				(searchable ? searchHeight : 0);

			place = placement(host, wanted, true);
			anchor();
		}

		open = !open;
	}

	const selected = $derived(options.find((option) => option.value === value));
	const showClear = $derived(clearable && !!value && !disabled);
	const searchable = $derived(options.length > 8);

	const visible = $derived.by(() => {
		const term = query.trim().toLowerCase();
		if (!term) return options;
		return options.filter((option) => option.label.toLowerCase().includes(term));
	});

	function tint(color: number | undefined): string {
		return color ? `#${color.toString(16).padStart(6, '0')}` : '#99aab5';
	}

	function choose(next: string) {
		value = next;
		open = false;
		query = '';
		onchange?.(next);
	}

	$effect(() => {
		if (!open || !list) return;

		const active = list.querySelector<HTMLElement>('[aria-selected="true"]');
		if (active) list.scrollTop = active.offsetTop - list.offsetTop - list.clientHeight / 2;
	});

	$effect(() => {
		if (!open) return;

		window.addEventListener('scroll', anchor, true);
		window.addEventListener('resize', anchor);

		return () => {
			window.removeEventListener('scroll', anchor, true);
			window.removeEventListener('resize', anchor);
		};
	});
</script>

<svelte:window
	onkeydown={(event) => event.key === 'Escape' && (open = false)}
	onpointerdown={(event) => {
		if (!open) return;

		const target = event.target as Node;
		if (host?.contains(target) || menu?.contains(target)) return;

		open = false;
	}}
/>

<div class="relative {open ? 'z-50' : ''}" bind:this={host}>
	<button
		type="button"
		onclick={toggle_}
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={label}
		aria-describedby={describedBy}
		class="flex min-h-10 w-full items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/5 pointer-coarse:min-h-11 {showClear
			? 'pr-14'
			: ''}"
	>
		{#if selected}
			{#if selected.iconUrl}
				<img src={selected.iconUrl} alt="" class="h-4 w-4 shrink-0 rounded" />
			{:else if selected.icon}
				{@const SelectedIcon = selected.icon}
				<SelectedIcon class="h-4 w-4 shrink-0 text-muted" />
			{:else if selected.color !== undefined}
				<span class="flex h-4 w-4 shrink-0 items-center justify-center">
					<span class="h-2.5 w-2.5 rounded-full" style="background: {tint(selected.color)}"></span>
				</span>
			{/if}
			{#if selected.prefix}
				<span class="shrink-0 text-muted">{selected.prefix}</span>
			{/if}
			<span class="min-w-0 flex-1 truncate {mono ? 'font-mono' : ''}">{selected.label}</span>
		{:else}
			<span class="flex-1 truncate text-muted {compact ? 'max-sm:hidden' : ''}">{placeholder}</span>
		{/if}

		<ChevronDown
			class="h-4 w-4 shrink-0 text-muted {open ? 'rotate-180' : ''} transition-transform"
		/>
	</button>

	{#if showClear}
		<button
			type="button"
			onclick={() => choose('')}
			aria-label="Clear selection"
			class="absolute top-1/2 right-8 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:bg-white/10 hover:text-white"
		>
			<X class="h-3.5 w-3.5" />
		</button>
	{/if}

	{#if open}
		<div
			bind:this={menu}
			use:portal
			class="fixed z-110 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
			style="left: {rect.left}px; width: {rect.width}px; max-height: {place.max}px; {place.up
				? `bottom: ${rect.above + 8}px`
				: `top: ${rect.below + 8}px`}"
			transition:fly={{ y: -6, duration: 150 }}
		>
			{#if searchable}
				<div class="flex items-center gap-2 border-b border-line px-3">
					<Search class="h-4 w-4 shrink-0 text-muted" />
					<input
						bind:value={query}
						placeholder="Search"
						aria-label="Search options"
						class="w-full border-0 bg-transparent px-0 py-2.5 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
					/>
				</div>
			{/if}

			<ul bind:this={list} class="min-h-0 flex-1 overflow-y-auto p-1" role="listbox">
				{#each visible as option, index (option.value)}
					{@const active = option.value === value}
					{#if option.group && option.group !== visible[index - 1]?.group}
						<li class="px-2.5 pt-2 pb-1 text-xs font-medium text-muted">{option.group}</li>
					{/if}
					<li>
						<button
							type="button"
							role="option"
							aria-selected={active}
							onclick={() => choose(option.value)}
							class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors {active
								? 'bg-white/8 text-white'
								: 'text-muted hover:bg-white/5'}"
						>
							{#if option.iconUrl}
								<img src={option.iconUrl} alt="" class="h-4 w-4 shrink-0 rounded" />
							{:else if option.icon}
								{@const OptionIcon = option.icon}
								<OptionIcon class="h-4 w-4 shrink-0" />
							{:else if option.color !== undefined}
								<span class="flex h-4 w-4 shrink-0 items-center justify-center">
									<span class="h-2.5 w-2.5 rounded-full" style="background: {tint(option.color)}"
									></span>
								</span>
							{/if}
							{#if option.prefix}
								<span class="w-2.5 shrink-0 text-center text-muted">{option.prefix}</span>
							{/if}
							<span class="min-w-0 flex-1 truncate {mono ? 'font-mono' : ''}">{option.label}</span>
							{#if option.hint}
								<span class="shrink-0 text-xs text-muted">{option.hint}</span>
							{/if}
							{#if active}
								<Check class="h-4 w-4 shrink-0" />
							{/if}
						</button>
					</li>
				{:else}
					<li class="px-3 py-6 text-center text-sm text-muted">Nothing matches "{query}".</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
