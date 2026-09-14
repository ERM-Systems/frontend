<script lang="ts">
	import Crosshair from '@lucide/svelte/icons/crosshair';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		clampPoint,
		isClick,
		mapSize,
		maxPoints,
		minPoints,
		regionCentre,
		type AopPoint,
		type AopRegion
	} from '$lib/aop';

	let { region = $bindable() }: { region: AopRegion } = $props();

	const minZoom = 0.1;
	const maxZoom = 3;
	const zoomStep = 1.25;

	let zoom = $state(0);
	let offset = $state({ x: 0, y: 0 });
	let width = $state(0);
	let height = $state(0);
	let surface = $state<HTMLElement>();
	let dragging = $state<number | null>(null);
	let selected = $state<number | null>(null);
	let panning: { x: number; y: number; startX: number; startY: number } | null = null;
	let pressedAt: { x: number; y: number } | null = null;

	const closed = $derived(region.points.length >= minPoints);
	const full = $derived(region.points.length >= maxPoints);

	const fitZoom = $derived(width && height ? Math.min(width, height) / mapSize : minZoom);
	const level = $derived(zoom || fitZoom);

	const outline = $derived(
		region.points
			.map((point) => `${(point.x / mapSize) * 100},${(point.z / mapSize) * 100}`)
			.join(' ')
	);

	function clamp(value: number): number {
		return Math.min(maxZoom, Math.max(minZoom, Math.round(value * 100) / 100));
	}

	function toMap(event: PointerEvent): AopPoint {
		const box = surface!.getBoundingClientRect();
		const x = (event.clientX - box.left - box.width / 2 - offset.x) / level + mapSize / 2;
		const z = (event.clientY - box.top - box.height / 2 - offset.y) / level + mapSize / 2;

		return clampPoint({ x, z });
	}

	function capture(event: PointerEvent) {
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			return;
		}
	}

	function grab(event: PointerEvent, index: number) {
		event.stopPropagation();
		capture(event);
		dragging = index;
	}

	function move(event: PointerEvent) {
		if (dragging !== null) {
			const next = toMap(event);
			region.points = region.points.map((point, at) => (at === dragging ? next : point));
			return;
		}

		if (!panning) return;
		offset = {
			x: panning.x + (event.clientX - panning.startX),
			y: panning.y + (event.clientY - panning.startY)
		};
	}

	function release() {
		dragging = null;
		panning = null;
	}

	function startPan(event: PointerEvent) {
		if (event.button !== 0) return;
		capture(event);
		panning = { x: offset.x, y: offset.y, startX: event.clientX, startY: event.clientY };
		pressedAt = { x: event.clientX, y: event.clientY };
	}

	function surfaceUp(event: PointerEvent) {
		const wasDragging = dragging !== null;
		const started = pressedAt;

		release();
		pressedAt = null;

		if (wasDragging || !started) return;
		if (!isClick(started, { x: event.clientX, y: event.clientY })) return;

		selected = null;
		if (full) return;

		region.points = [...region.points, toMap(event)];
	}

	function addPoint() {
		if (full) return;

		region.points = [...region.points, clampPoint(regionCentre(region.points))];
	}

	function addPointAfter(index: number) {
		if (region.points.length >= maxPoints) return;

		const current = region.points[index];
		const next = region.points[(index + 1) % region.points.length];
		const midpoint = clampPoint({ x: (current.x + next.x) / 2, z: (current.z + next.z) / 2 });

		region.points = [
			...region.points.slice(0, index + 1),
			midpoint,
			...region.points.slice(index + 1)
		];
	}

	function removePoint(index: number) {
		region.points = region.points.filter((_, at) => at !== index);
		selected = null;
	}

	function nudge(index: number, dx: number, dz: number) {
		region.points = region.points.map((point, at) =>
			at === index ? clampPoint({ x: point.x + dx, z: point.z + dz }) : point
		);
	}

	function keys(event: KeyboardEvent, index: number) {
		const step = event.shiftKey ? 50 : 10;
		const moves: Record<string, [number, number]> = {
			ArrowUp: [0, -step],
			ArrowDown: [0, step],
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0]
		};

		const delta = moves[event.key];
		if (delta) {
			event.preventDefault();
			nudge(index, delta[0], delta[1]);
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			addPointAfter(index);
		} else if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			removePoint(index);
		}
	}

	function fit() {
		zoom = 0;
		offset = { x: 0, y: 0 };
	}

	function centre() {
		const middle = regionCentre(region.points);
		offset = { x: -(middle.x - mapSize / 2) * level, y: -(middle.z - mapSize / 2) * level };
	}

	function wheel(event: WheelEvent) {
		event.preventDefault();
		zoom = clamp(level * (event.deltaY < 0 ? zoomStep : 1 / zoomStep));
	}
</script>

<div class="relative overflow-hidden rounded-xl border border-line bg-bg">
	<div
		bind:this={surface}
		bind:clientWidth={width}
		bind:clientHeight={height}
		role="application"
		aria-label="Area of play editor for {region.name}. Drag the numbered handles to reshape the area."
		onpointerdown={startPan}
		onpointermove={move}
		onpointerup={surfaceUp}
		onpointercancel={release}
		onwheel={wheel}
		class="relative h-[70dvh] min-h-100 cursor-grab active:cursor-grabbing"
	>
		<div
			class="absolute top-1/2 left-1/2 origin-center"
			style="width: {mapSize}px; height: {mapSize}px; transform: translate(-50%, -50%) translate({offset.x}px, {offset.y}px) scale({level})"
		>
			<img
				src="/maps/fall_postals.png"
				alt=""
				draggable="false"
				class="pointer-events-none absolute inset-0 h-full w-full select-none"
			/>

			<svg class="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100">
				{#if closed}
					<polygon
						points={outline}
						fill="rgb(217 82 78 / 0.18)"
						stroke="rgb(217 82 78)"
						stroke-width="2"
						vector-effect="non-scaling-stroke"
					/>
				{:else if region.points.length > 1}
					<polyline
						points={outline}
						fill="none"
						stroke="rgb(217 82 78)"
						stroke-width="2"
						stroke-dasharray="4 3"
						vector-effect="non-scaling-stroke"
					/>
				{/if}
			</svg>

			{#each region.points as point, index (index)}
				<button
					type="button"
					onpointerdown={(event) => grab(event, index)}
					onkeydown={(event) => keys(event, index)}
					onclick={() => (selected = index)}
					ondblclick={() => addPointAfter(index)}
					aria-pressed={selected === index}
					aria-label="Point {index + 1} of {region.points
						.length}, at {point.x} by {point.z}. Arrow keys move it, enter adds a point, delete removes it."
					class="absolute flex h-5.5 w-5.5 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white {selected ===
					index
						? 'bg-white text-red-600'
						: 'bg-red-500 text-white'}"
					style="left: {(point.x / mapSize) * 100}%; top: {(point.z / mapSize) *
						100}%; transform: translate(-50%, -50%) scale({1 / level})"
				>
					{index + 1}
				</button>
			{/each}
		</div>
	</div>

	<div class="pointer-events-none absolute top-3 right-3 flex flex-col gap-1.5">
		<Tooltip text="Zoom in">
			<button
				type="button"
				onclick={() => (zoom = clamp(level * zoomStep))}
				aria-label="Zoom in"
				class="tap pointer-events-auto rounded-lg border border-line bg-surface/90 p-2 text-muted backdrop-blur transition-colors hover:bg-white/8 hover:text-white"
			>
				<Plus class="h-4 w-4" />
			</button>
		</Tooltip>
		<Tooltip text="Zoom out">
			<button
				type="button"
				onclick={() => (zoom = clamp(level / zoomStep))}
				aria-label="Zoom out"
				class="tap pointer-events-auto rounded-lg border border-line bg-surface/90 p-2 text-muted backdrop-blur transition-colors hover:bg-white/8 hover:text-white"
			>
				<Minus class="h-4 w-4" />
			</button>
		</Tooltip>
		<Tooltip text="Fit the whole map">
			<button
				type="button"
				onclick={fit}
				aria-label="Fit the whole map"
				class="tap pointer-events-auto rounded-lg border border-line bg-surface/90 p-2 text-muted backdrop-blur transition-colors hover:bg-white/8 hover:text-white"
			>
				<RotateCcw class="h-4 w-4" />
			</button>
		</Tooltip>
		<Tooltip text="Centre on the area">
			<button
				type="button"
				onclick={centre}
				aria-label="Centre on the area"
				class="tap pointer-events-auto rounded-lg border border-line bg-surface/90 p-2 text-muted backdrop-blur transition-colors hover:bg-white/8 hover:text-white"
			>
				<Crosshair class="h-4 w-4" />
			</button>
		</Tooltip>
	</div>
</div>

<div class="mt-3 flex flex-wrap items-center gap-3">
	<p aria-live="polite" class="sr-only">
		{region.points.length} point{region.points.length === 1 ? '' : 's'}{closed
			? ', area closed'
			: ''}
	</p>

	<p class="text-sm text-muted">
		{#if !region.points.length}
			Click the map to drop your first point, or use Add point.
		{:else if !closed}
			{region.points.length} of {minPoints} points. Keep clicking, the area closes itself at {minPoints}.
		{:else if full}
			{maxPoints} of {maxPoints} points, the maximum. Delete a point before adding another.
		{:else}
			{region.points.length} of {maxPoints} points, area closed. Click to add another, click a handle
			to select it.
		{/if}
	</p>

	<div class="ml-auto flex flex-wrap gap-2">
		<button
			type="button"
			onclick={addPoint}
			disabled={full}
			class="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:cursor-not-allowed disabled:opacity-40"
		>
			<Plus class="h-3 w-3" aria-hidden="true" />
			Add point
		</button>

		{#if selected !== null && selected < region.points.length}
			<button
				type="button"
				onclick={() => removePoint(selected!)}
				class="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
			>
				<Trash2 class="h-3 w-3" aria-hidden="true" />
				Delete point {selected! + 1}
			</button>
		{/if}
	</div>
</div>
