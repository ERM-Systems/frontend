<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Lock from '@lucide/svelte/icons/lock';
	import X from '@lucide/svelte/icons/x';
	import { fly } from 'svelte/transition';
	import { placement } from '$lib/dropdown';

	export interface Choice {
		value: string;
		label: string;
	}

	let {
		options,
		values = $bindable([]),
		placeholder = 'Select options',
		locked = [],
		onchange,
		label
	}: {
		options: Choice[];
		values: string[];
		placeholder?: string;
		locked?: string[];
		onchange?: (values: string[]) => void;
		label?: string;
	} = $props();

	let open = $state(false);
	let host = $state<HTMLElement>();
	let place = $state({ up: false, max: 320 });

	const chosen = $derived(
		values.map(
			(value) => options.find((option) => option.value === value) ?? { value, label: value }
		)
	);

	function toggle_() {
		if (!open) place = placement(host);
		open = !open;
	}

	function toggle(value: string) {
		if (locked.includes(value)) return;

		values = values.includes(value)
			? values.filter((entry) => entry !== value)
			: [...values, value];

		onchange?.(values);
	}
</script>

<svelte:window
	onkeydown={(event) => event.key === 'Escape' && (open = false)}
	onpointerdown={(event) => {
		if (open && host && !host.contains(event.target as Node)) open = false;
	}}
/>

<div class="relative {open ? 'z-50' : ''}" bind:this={host}>
	<div
		class="relative flex min-h-10 w-full items-center gap-3 rounded-lg border border-line bg-white/5 px-3 py-2 pointer-coarse:min-h-11"
	>
		<button
			type="button"
			onclick={toggle_}
			aria-haspopup="listbox"
			aria-expanded={open}
			aria-label={label}
			class="absolute inset-0 rounded-lg transition-colors hover:bg-white/8"
		></button>

		<span
			class="pointer-events-none relative flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-0.5"
		>
			{#each chosen as option (option.value)}
				<span
					class="flex min-w-0 items-center gap-1 rounded-md border border-line bg-white/5 py-0.5 pl-2 text-xs"
				>
					<span class="truncate">{option.label}</span>
					{#if locked.includes(option.value)}
						<Lock class="mr-2 h-3 w-3 shrink-0 opacity-60" />
					{:else}
						<button
							type="button"
							onclick={() => toggle(option.value)}
							aria-label="Remove {option.label}"
							class="pointer-events-auto shrink-0 rounded px-1.5 py-0.5 text-muted transition-colors hover:text-white"
						>
							<X class="h-3 w-3" />
						</button>
					{/if}
				</span>
			{/each}

			{#if !chosen.length}
				<span class="text-sm text-muted">{placeholder}</span>
			{/if}
		</span>

		<ChevronDown
			class="relative h-4 w-4 shrink-0 text-muted {open ? 'rotate-180' : ''} transition-transform"
		/>
	</div>

	{#if open}
		<div
			class="absolute {place.up
				? 'bottom-full mb-2'
				: 'top-full mt-2'} right-0 left-0 z-60 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
			style="max-height: {place.max}px"
			transition:fly={{ y: -6, duration: 150 }}
		>
			<ul class="min-h-0 flex-1 overflow-y-auto p-1" role="listbox" aria-multiselectable="true">
				{#each options as option (option.value)}
					{@const active = values.includes(option.value)}
					{@const fixed = locked.includes(option.value)}
					<li>
						<button
							type="button"
							role="option"
							aria-selected={active}
							disabled={fixed}
							onclick={() => toggle(option.value)}
							class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors {active
								? 'bg-white/8 text-white'
								: 'text-muted hover:bg-white/5'} {fixed ? 'cursor-not-allowed' : ''}"
						>
							<span class="min-w-0 flex-1 truncate">{option.label}</span>
							{#if fixed}
								<Lock class="h-3.5 w-3.5 shrink-0 opacity-60" />
							{:else if active}
								<Check class="h-4 w-4 shrink-0" />
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
