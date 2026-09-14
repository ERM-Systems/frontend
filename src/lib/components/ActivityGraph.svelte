<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import type { DailyActivity } from '$lib/stats';

	const { daily, year = null }: { daily: Record<string, DailyActivity>; year?: number | null } =
		$props();

	const months = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

	const dayMs = 86_400_000;

	const columns = $derived.by(() => {
		const today = Math.floor(Date.now() / dayMs) * dayMs;

		const last = year === null ? today : Date.UTC(year, 11, 31);
		const first = year === null ? last - 364 * dayMs : Date.UTC(year, 0, 1);

		const start = first - new Date(first).getUTCDay() * dayMs;
		const weeks = Math.ceil((last - start) / dayMs / 7);

		return Array.from({ length: weeks }, (_, week) =>
			Array.from({ length: 7 }, (_, day) => {
				const stamp = start + (week * 7 + day) * dayMs;
				const date = new Date(stamp);
				const id = date.toISOString().slice(0, 10);

				const activity = daily[id];

				return {
					id,
					month: date.getUTCMonth(),
					dayOfMonth: date.getUTCDate(),
					future: stamp > today || stamp > last || stamp < first,
					count: activity?.moderations ?? 0,
					shifts: activity?.shifts ?? 0,
					seconds: activity?.seconds ?? 0
				};
			})
		);
	});

	const labels = $derived(
		columns.map((column, index) => {
			if (index > columns.length - 4) return '';

			const opening = column.find((day) => day.dayOfMonth === 1);
			return opening ? months[opening.month] : '';
		})
	);

	const shades = ['bg-white/5', 'bg-red-500/25', 'bg-red-500/45', 'bg-red-500/70', 'bg-red-500'];

	function shade(count: number): string {
		if (!count) return shades[0];
		if (count < 3) return shades[1];
		if (count < 6) return shades[2];
		if (count < 10) return shades[3];
		return shades[4];
	}

	const weekdays = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

	function duration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
	}

	type Day = (typeof columns)[number][number];

	function label(day: Day): string {
		const punishments = `${day.count} ${day.count === 1 ? 'punishment' : 'punishments'}`;
		if (!day.shifts) return `${punishments} on ${day.id}`;

		return `${punishments}, ${day.shifts} ${day.shifts === 1 ? 'shift' : 'shifts'} (${duration(day.seconds)}) on ${day.id}`;
	}

	let wrapper = $state<HTMLElement>();
	let hovered = $state<{ day: Day; x: number; y: number } | null>(null);

	function show(event: PointerEvent, day: Day) {
		if (day.future || !wrapper) return;

		const cell = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const box = wrapper.getBoundingClientRect();

		hovered = { day, x: cell.left - box.left + cell.width / 2, y: cell.top - box.top };
	}

	function stamp(id: string): string {
		return new Date(`${id}T00:00:00Z`).toLocaleDateString('en', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}
</script>

<div class="relative" bind:this={wrapper}>
	<div class="overflow-x-auto pb-2">
		<div
			class="grid min-w-160 grid-cols-[auto_repeat(var(--weeks),minmax(0,1fr))] gap-0.75 text-[10px] leading-3 text-muted"
			style="--weeks: {columns.length}"
			role="table"
			aria-label="Moderation activity"
			onpointerleave={() => (hovered = null)}
		>
			<span></span>
			{#each columns as column, index (column[0].id)}
				<span class="relative block h-4">
					<span class="absolute top-0 left-0 whitespace-nowrap">{labels[index]}</span>
				</span>
			{/each}

			{#each weekdays as weekday, row (row)}
				<span class="self-center pr-1 text-right">{weekday}</span>
				{#each columns as column (column[0].id)}
					{@const day = column[row]}
					<span
						role={day.future ? undefined : 'cell'}
						aria-label={day.future ? undefined : label(day)}
						class="aspect-square w-full rounded-xs {day.future ? '' : shade(day.count)}"
						onpointerenter={(event) => show(event, day)}
					></span>
				{/each}
			{/each}
		</div>
	</div>

	{#if hovered}
		<div
			class="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full pb-2"
			style="left: {hovered.x}px; top: {hovered.y}px"
			in:fly={{ y: 4, duration: 120 }}
			out:fade={{ duration: 100 }}
		>
			<div
				class="rounded-lg border border-line bg-bg px-3 py-2 text-xs whitespace-nowrap shadow-xl shadow-black/50"
			>
				<p class="font-medium">{stamp(hovered.day.id)}</p>
				<p class="mt-1 text-muted">
					{hovered.day.count}
					{hovered.day.count === 1 ? 'punishment' : 'punishments'}
				</p>
				<p class="text-muted">
					{#if hovered.day.shifts}
						{hovered.day.shifts}
						{hovered.day.shifts === 1 ? 'shift' : 'shifts'}, {duration(hovered.day.seconds)} on duty
					{:else}
						No shifts
					{/if}
				</p>
			</div>
		</div>
	{/if}
</div>

<div class="mt-4 flex items-center gap-1.5 text-xs text-muted">
	<span class="mr-0.5">Less</span>
	{#each shades as tone (tone)}
		<span class="h-3 w-3 rounded-[3px] {tone}"></span>
	{/each}
	<span class="ml-0.5">More</span>
</div>
