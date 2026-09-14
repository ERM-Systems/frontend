<script module lang="ts">
	export function isoDate(date: Date = new Date()): string {
		const month = `${date.getMonth() + 1}`.padStart(2, '0');
		const day = `${date.getDate()}`.padStart(2, '0');

		return `${date.getFullYear()}-${month}-${day}`;
	}
</script>

<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import { fly } from 'svelte/transition';
	import { placement } from '$lib/dropdown';

	let {
		value = $bindable(''),
		placeholder = 'Select a date',
		label = 'Select a date',
		min = '',
		max = '',
		clearable = false
	}: {
		value: string;
		placeholder?: string;
		label?: string;
		min?: string;
		max?: string;
		clearable?: boolean;
	} = $props();

	const long = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
	const heading = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
	const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
	const panelWidth = 268;
	const gap = 8;

	const uid = $props.id();

	function parse(text: string): Date | null {
		const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
		if (!parts) return null;

		const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));

		return Number.isNaN(date.getTime()) ? null : date;
	}

	const today = isoDate();

	let open = $state(false);
	let host = $state<HTMLElement>();
	let grid = $state<HTMLElement>();
	let place = $state({ up: false, max: 320 });
	let nudge = $state(0);
	let cursor = $state(parse(value) ?? new Date());

	const selected = $derived(parse(value));
	const showClear = $derived(clearable && value !== '');

	const days = $derived.by(() => {
		const year = cursor.getFullYear();
		const month = cursor.getMonth();
		const lead = (new Date(year, month, 1).getDay() + 6) % 7;
		const total = new Date(year, month + 1, 0).getDate();
		const cells: (Date | null)[] = Array.from({ length: lead }, () => null);

		for (let day = 1; day <= total; day += 1) cells.push(new Date(year, month, day));
		while (cells.length % 7) cells.push(null);

		return cells;
	});

	function blocked(date: Date): boolean {
		const key = isoDate(date);

		return (min !== '' && key < min) || (max !== '' && key > max);
	}

	function offset(): number {
		if (!host) return 0;

		const rect = host.getBoundingClientRect();
		const overflow = rect.left + Math.max(panelWidth, rect.width) + gap - window.innerWidth;

		return overflow > 0 ? -Math.min(overflow, Math.max(rect.left - gap, 0)) : 0;
	}

	function toggle_() {
		if (open) {
			open = false;
			return;
		}

		cursor = parse(value) ?? new Date();
		place = placement(host);
		nudge = offset();
		open = true;
	}

	function choose(date: Date) {
		if (blocked(date)) return;

		value = isoDate(date);
		open = false;
	}

	function move(date: Date) {
		cursor = date;
	}

	function keys(event: KeyboardEvent) {
		const year = cursor.getFullYear();
		const month = cursor.getMonth();
		const day = cursor.getDate();

		if (event.key === 'ArrowLeft') move(new Date(year, month, day - 1));
		else if (event.key === 'ArrowRight') move(new Date(year, month, day + 1));
		else if (event.key === 'ArrowUp') move(new Date(year, month, day - 7));
		else if (event.key === 'ArrowDown') move(new Date(year, month, day + 7));
		else if (event.key === 'PageUp') move(new Date(year, month - 1, day));
		else if (event.key === 'PageDown') move(new Date(year, month + 1, day));
		else if (event.key === 'Home') move(new Date(year, month, 1));
		else if (event.key === 'End') move(new Date(year, month + 1, 0));
		else if (event.key === 'Enter' || event.key === ' ') choose(cursor);
		else return;

		event.preventDefault();
	}

	$effect(() => {
		if (open) grid?.focus();
	});
</script>

<svelte:window
	onkeydown={(event) => event.key === 'Escape' && (open = false)}
	onpointerdown={(event) => {
		if (open && host && !host.contains(event.target as Node)) open = false;
	}}
/>

<div class="relative {open ? 'z-50' : ''}" bind:this={host}>
	<button
		type="button"
		onclick={toggle_}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={label}
		class="flex min-h-10 w-full items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/8 pointer-coarse:min-h-11 {showClear
			? 'pr-10'
			: ''}"
	>
		<CalendarDays class="h-4 w-4 shrink-0 text-muted" />

		<span class="min-w-0 flex-1 truncate {selected ? '' : 'text-muted'}">
			{selected ? long.format(selected) : placeholder}
		</span>
	</button>

	{#if showClear}
		<button
			type="button"
			onclick={() => (value = '')}
			aria-label="Clear date"
			class="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:bg-white/10 hover:text-white"
		>
			<X class="h-3.5 w-3.5" />
		</button>
	{/if}

	{#if open}
		<div
			class="absolute {place.up
				? 'bottom-full mb-2'
				: 'top-full mt-2'} left-0 z-60 flex w-67 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
			style="margin-left: {nudge}px; max-height: {place.max}px"
			transition:fly={{ y: -6, duration: 150 }}
		>
			<div class="flex items-center gap-2 border-b border-line px-2 py-2">
				<button
					type="button"
					onclick={() => move(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
					aria-label="Previous month"
					class="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
				>
					<ChevronLeft class="h-4 w-4" />
				</button>

				<span class="min-w-0 flex-1 truncate text-center text-sm font-medium">
					{heading.format(cursor)}
				</span>

				<button
					type="button"
					onclick={() => move(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
					aria-label="Next month"
					class="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
				>
					<ChevronRight class="h-4 w-4" />
				</button>
			</div>

			<div class="grid grid-cols-7 gap-0.5 px-2 pt-2">
				{#each weekdays as weekday (weekday)}
					<span class="py-1 text-center text-xs text-muted">{weekday}</span>
				{/each}
			</div>

			<div
				bind:this={grid}
				role="listbox"
				tabindex="-1"
				aria-label="{heading.format(cursor)} calendar"
				aria-activedescendant="{uid}-{isoDate(cursor)}"
				onkeydown={keys}
				class="grid min-h-0 flex-1 grid-cols-7 gap-0.5 overflow-y-auto p-2 focus:outline-none"
			>
				{#each days as day, position (position)}
					{#if day}
						{@const key = isoDate(day)}
						{@const off = blocked(day)}
						<button
							type="button"
							role="option"
							id="{uid}-{key}"
							tabindex="-1"
							disabled={off}
							aria-selected={key === value}
							onclick={() => choose(day)}
							class="relative flex h-8 items-center justify-center rounded-md text-sm transition-colors {key ===
							value
								? 'bg-white font-semibold text-bg'
								: off
									? 'cursor-not-allowed text-muted/40'
									: 'text-muted hover:bg-white/8 hover:text-white'} {key === isoDate(cursor) &&
							key !== value
								? 'ring-1 ring-white/25'
								: ''}"
						>
							{day.getDate()}
							{#if key === today && key !== value}
								<span class="absolute bottom-1 h-1 w-1 rounded-full bg-red-500"></span>
							{/if}
						</button>
					{:else}
						<span class="h-8"></span>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>
