<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import { fly } from 'svelte/transition';
	import {
		colorFormats,
		formatAccent,
		hexToHsv,
		hsvToHex,
		parseAccent,
		type ColorFormat
	} from '$lib/serverOverview';
	import { toast } from '$lib/toast.svelte';

	let {
		value = $bindable(),
		presets = [],
		label = 'Colour',
		empty = false,
		compact = false,
		onclear
	}: {
		value: string;
		presets?: { value: string; label: string }[];
		label?: string;
		empty?: boolean;
		compact?: boolean;
		onclear?: () => void;
	} = $props();

	const hsv = $derived(hexToHsv(value));
	const hue = $derived(hsvToHex({ h: hsv.h, s: 1, v: 1 }));

	let format = $state<ColorFormat>('hex');
	let draft = $derived(formatAccent(value, format));
	let open = $state(false);
	let copied = $state(false);
	let shell = $state<HTMLDivElement>();
	let trigger = $state<HTMLButtonElement>();
	let spot = $state({ left: 0, top: 0 });

	const panelWidth = 256;
	const panelHeight = 272;
	const margin = 8;

	function place() {
		if (!trigger) return;

		const box = trigger.getBoundingClientRect();
		const below = box.bottom + margin + panelHeight <= window.innerHeight;

		spot = {
			left: Math.max(
				margin,
				Math.min(box.right - panelWidth, window.innerWidth - panelWidth - margin)
			),
			top: below ? box.bottom + margin : Math.max(margin, box.top - margin - panelHeight)
		};
	}

	$effect(() => {
		if (!open) return;

		const close = () => (open = false);
		document.addEventListener('scroll', close, true);

		return () => document.removeEventListener('scroll', close, true);
	});

	function toggle() {
		if (!open) place();
		open = !open;
	}

	function clamp(input: number): number {
		return Math.min(1, Math.max(0, input));
	}

	function track(event: PointerEvent, update: (x: number, y: number) => void) {
		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);

		const move = (moved: PointerEvent) => {
			const box = target.getBoundingClientRect();
			update(
				clamp((moved.clientX - box.left) / box.width),
				clamp((moved.clientY - box.top) / box.height)
			);
		};

		move(event);
		return move;
	}

	let dragging = $state<((event: PointerEvent) => void) | null>(null);

	function commit(input: string) {
		const hex = parseAccent(input, format);
		if (hex) value = hex;
	}

	function cycle() {
		format = colorFormats[(colorFormats.indexOf(format) + 1) % colorFormats.length];
	}

	function nudge(event: KeyboardEvent) {
		const step = 0.04;
		const keys: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, step],
			ArrowDown: [0, -step]
		};

		const move = keys[event.key];
		if (!move) return;

		event.preventDefault();
		value = hsvToHex({ h: hsv.h, s: clamp(hsv.s + move[0]), v: clamp(hsv.v + move[1]) });
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(formatAccent(value, format));
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast('Could not copy that colour.', 'error');
		}
	}
</script>

<svelte:window
	onresize={() => (open = false)}
	onkeydown={(event) => event.key === 'Escape' && (open = false)}
	onpointerdown={(event) => {
		if (open && shell && !shell.contains(event.target as Node)) open = false;
	}}
/>

<div class="relative w-fit" bind:this={shell}>
	<button
		type="button"
		bind:this={trigger}
		onclick={toggle}
		aria-expanded={open}
		aria-label="Pick a {label.toLowerCase()}"
		title={empty ? 'No colour' : value}
		class="{compact
			? 'h-6 w-6 rounded-md'
			: 'h-9 w-9 rounded-lg pointer-coarse:h-11 pointer-coarse:w-11'} border border-line transition-transform hover:scale-105"
		style="background: {empty
			? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.09) 0 5px, transparent 5px 10px)'
			: value}"
	></button>

	{#if open}
		<div
			class="fixed z-70 w-64 rounded-xl border border-line bg-surface p-3 shadow-2xl shadow-black/60"
			data-picker-open
			style="left: {spot.left}px; top: {spot.top}px"
			transition:fly={{ y: -4, duration: 120 }}
		>
			<button
				type="button"
				aria-label="{label} saturation and brightness"
				onkeydown={nudge}
				onpointerdown={(event) =>
					(dragging = track(event, (x, y) => (value = hsvToHex({ h: hsv.h, s: x, v: 1 - y }))))}
				onpointermove={(event) => dragging?.(event)}
				onpointerup={() => (dragging = null)}
				onpointercancel={() => (dragging = null)}
				class="relative h-32 w-full cursor-crosshair touch-none overflow-hidden rounded-lg border border-line focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
				style="background:
					linear-gradient(to top, #000, transparent),
					linear-gradient(to right, #fff, {hue})"
			>
				<span
					class="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
					style="left: clamp(8px, {hsv.s * 100}%, calc(100% - 8px)); top: clamp(8px, {(1 - hsv.v) *
						100}%, calc(100% - 8px)); background: {value}"
				></span>
			</button>

			<div
				role="slider"
				aria-label="{label} hue"
				aria-valuemin="0"
				aria-valuemax="360"
				aria-valuenow={Math.round(hsv.h * 360)}
				tabindex="0"
				onkeydown={(event) => {
					if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
					event.preventDefault();
					const step = event.key === 'ArrowLeft' ? -1 / 60 : 1 / 60;
					value = hsvToHex({ ...hsv, h: (hsv.h + step + 1) % 1 });
				}}
				onpointerdown={(event) =>
					(dragging = track(event, (x) => (value = hsvToHex({ ...hsv, h: x === 1 ? 0.999 : x }))))}
				onpointermove={(event) => dragging?.(event)}
				onpointerup={() => (dragging = null)}
				onpointercancel={() => (dragging = null)}
				class="relative mt-2.5 h-3 w-full cursor-pointer touch-none rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
				style="background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
			>
				<span
					class="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
					style="left: clamp(8px, {hsv.h * 100}%, calc(100% - 8px)); background: {hue}"
				></span>
			</div>

			<div
				class="mt-2.5 flex h-10 items-center gap-2 rounded-lg border border-line bg-white/5 px-3 focus-within:border-white/25"
			>
				<button
					type="button"
					onclick={cycle}
					aria-label="Change colour format, currently {format.toUpperCase()}"
					class="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase transition-colors hover:bg-white/5 hover:text-white"
				>
					{format}
				</button>

				<input
					type="text"
					bind:value={draft}
					oninput={() => commit(draft)}
					onblur={() => (draft = formatAccent(value, format))}
					spellcheck="false"
					autocomplete="off"
					maxlength={format === 'hex' ? 7 : 20}
					aria-label="{label} {format}"
					class="h-full w-full min-w-0 border-0 bg-transparent p-0 text-sm tracking-wide uppercase placeholder:text-muted focus:ring-0"
					placeholder={formatAccent('#f03232', format)}
				/>

				<button
					type="button"
					onclick={copy}
					aria-label="Copy colour"
					class="shrink-0 text-muted transition-colors hover:text-white"
				>
					{#if copied}
						<Check class="h-4 w-4 text-green-400" />
					{:else}
						<Copy class="h-4 w-4" />
					{/if}
				</button>
			</div>

			{#if presets.length}
				<div class="mt-2.5 flex items-center justify-between">
					{#each presets as preset (preset.value)}
						<button
							type="button"
							onclick={() => (value = preset.value)}
							aria-label={preset.label}
							aria-pressed={value === preset.value}
							title={preset.label}
							class="flex h-6 w-6 items-center justify-center rounded-md border-2 transition-transform hover:scale-110 {value ===
							preset.value
								? 'border-white'
								: 'border-transparent'}"
							style="background: {preset.value}"
						>
							{#if value === preset.value}
								<Check class="h-3 w-3 text-white drop-shadow" />
							{/if}
						</button>
					{/each}
				</div>
			{/if}

			{#if onclear}
				<button
					type="button"
					onclick={() => {
						onclear();
						open = false;
					}}
					disabled={empty}
					class="mt-2.5 w-full rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
				>
					Clear colour
				</button>
			{/if}
		</div>
	{/if}
</div>
