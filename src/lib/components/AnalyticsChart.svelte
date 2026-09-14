<script lang="ts">
	import type { AnalyticsPoint } from '$lib/server/analytics';

	let { points }: { points: AnalyticsPoint[] } = $props();

	const ranges = [
		{ id: 'day', label: 'Past day', seconds: 86_400 },
		{ id: 'week', label: 'Past week', seconds: 7 * 86_400 },
		{ id: 'month', label: 'Past month', seconds: 30 * 86_400 }
	] as const;

	let range = $state<(typeof ranges)[number]['id']>('day');

	const span = $derived(ranges.find((entry) => entry.id === range)?.seconds ?? 86_400);
	const until = $derived(Math.floor(Date.now() / 1000));
	const since = $derived(until - span);

	const shown = $derived(points.filter((point) => point.timestamp >= since));

	const peak = $derived(Math.max(0, ...shown.map((point) => point.players)));
	const busiest = $derived(Math.max(0, ...shown.map((point) => point.onDuty)));

	const average = $derived(
		shown.length
			? Math.round(shown.reduce((sum, point) => sum + point.players, 0) / shown.length)
			: 0
	);

	const ceiling = $derived(Math.max(peak, 1));

	const line = $derived(
		shown
			.map((point) => {
				const x = ((point.timestamp - since) / span) * 100;
				return `${x.toFixed(2)},${(40 - (point.players / ceiling) * 38).toFixed(2)}`;
			})
			.join(' ')
	);

	const area = $derived(line ? `0,40 ${line} 100,40` : '');

	function stamp(seconds: number): string {
		const when = new Date(seconds * 1000);

		return span > 86_400
			? when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
			: when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
	}
</script>

<div class="flex flex-col gap-5 px-6 py-5">
	<div class="flex w-fit gap-1 rounded-lg border border-line bg-bg/40 p-1">
		{#each ranges as entry (entry.id)}
			<button
				type="button"
				onclick={() => (range = entry.id)}
				aria-current={range === entry.id ? 'page' : undefined}
				class="rounded-md px-3 py-1.5 text-sm transition-colors pointer-coarse:py-3 {range ===
				entry.id
					? 'bg-white/8 font-medium text-white'
					: 'text-muted hover:bg-white/5 hover:text-white'}"
			>
				{entry.label}
			</button>
		{/each}
	</div>

	{#if shown.length < 2}
		<p
			class="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted"
		>
			Not enough analytics recorded for this range yet.
		</p>
	{:else}
		<div class="grid gap-4 sm:grid-cols-3">
			<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
				<p class="text-xs tracking-wide text-muted uppercase">Peak players</p>
				<p class="mt-1 text-2xl font-semibold">{peak}</p>
			</div>

			<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
				<p class="text-xs tracking-wide text-muted uppercase">Average players</p>
				<p class="mt-1 text-2xl font-semibold">{average}</p>
			</div>

			<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
				<p class="text-xs tracking-wide text-muted uppercase">Most staff on duty</p>
				<p class="mt-1 text-2xl font-semibold">{busiest}</p>
			</div>
		</div>

		<div>
			<svg
				viewBox="0 0 100 40"
				preserveAspectRatio="none"
				role="img"
				aria-label="Players in game over the {ranges
					.find((entry) => entry.id === range)
					?.label.toLowerCase()}"
				class="h-40 w-full"
			>
				<polygon points={area} class="fill-red-500/12" />
				<polyline
					points={line}
					fill="none"
					stroke="currentColor"
					stroke-width="0.8"
					vector-effect="non-scaling-stroke"
					class="text-red-500"
				/>
			</svg>

			<div class="mt-2 flex justify-between text-xs text-muted">
				<span>{stamp(since)}</span>
				<span>{stamp(until)}</span>
			</div>
		</div>
	{/if}
</div>
