<script lang="ts">
	import type { Infraction } from '$lib/server/staff';

	let { infractions, months = 12 }: { infractions: Infraction[]; months?: number } = $props();

	const labels = new Intl.DateTimeFormat('en', { month: 'short' });
	const full = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });

	const totals = $derived({
		all: infractions.length,
		active: infractions.filter((entry) => !entry.revoked).length,
		revoked: infractions.filter((entry) => entry.revoked).length,
		escalated: infractions.filter((entry) => entry.escalated).length
	});

	const timeline = $derived.by(() => {
		const now = new Date();
		const buckets = Array.from({ length: months }, (_, index) => {
			const when = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);

			return {
				id: `${when.getFullYear()}-${when.getMonth()}`,
				label: labels.format(when),
				title: full.format(when),
				count: 0
			};
		});

		const index = new Map(buckets.map((bucket) => [bucket.id, bucket]));

		for (const entry of infractions) {
			if (!entry.timestamp) continue;

			const when = new Date(entry.timestamp * 1000);
			const bucket = index.get(`${when.getFullYear()}-${when.getMonth()}`);
			if (bucket) bucket.count += 1;
		}

		return buckets;
	});

	const peak = $derived(Math.max(1, ...timeline.map((bucket) => bucket.count)));

	const byType = $derived.by(() => {
		const counts: Record<string, number> = {};

		for (const entry of infractions) {
			const type = entry.type || 'Unknown';
			counts[type] = (counts[type] ?? 0) + 1;
		}

		return Object.entries(counts)
			.map(([type, count]) => ({ type, count }))
			.sort((a, b) => b.count - a.count);
	});
</script>

{#if !infractions.length}
	<p class="px-6 py-10 text-center text-sm text-muted">
		Nothing to visualise until this member picks up an infraction.
	</p>
{:else}
	<div class="flex flex-col gap-6 px-6 py-5">
		<dl class="grid gap-4 sm:grid-cols-4">
			<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
				<dt class="text-xs tracking-wide text-muted uppercase">Total</dt>
				<dd class="mt-1 text-2xl font-semibold">{totals.all}</dd>
			</div>

			<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
				<dt class="text-xs tracking-wide text-muted uppercase">Standing</dt>
				<dd class="mt-1 text-2xl font-semibold">{totals.active}</dd>
			</div>

			<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
				<dt class="text-xs tracking-wide text-muted uppercase">Revoked</dt>
				<dd class="mt-1 text-2xl font-semibold">{totals.revoked}</dd>
			</div>

			<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
				<dt class="text-xs tracking-wide text-muted uppercase">Escalated</dt>
				<dd class="mt-1 text-2xl font-semibold">{totals.escalated}</dd>
			</div>
		</dl>

		<div>
			<p class="text-xs tracking-wide text-muted uppercase">Last {months} months</p>

			<div class="mt-3 flex h-32 items-end gap-1.5">
				{#each timeline as bucket (bucket.id)}
					<span
						title="{bucket.count} {bucket.count === 1
							? 'infraction'
							: 'infractions'} in {bucket.title}"
						style="height: {Math.max(2, (bucket.count / peak) * 100)}%"
						class="flex-1 rounded-t-sm {bucket.count ? 'bg-red-500' : 'bg-white/8'}"
					></span>
				{/each}
			</div>

			<div class="mt-2 flex gap-1.5 text-[10px] text-muted">
				{#each timeline as bucket (bucket.id)}
					<span class="flex-1 text-center">{bucket.label}</span>
				{/each}
			</div>
		</div>

		<div>
			<p class="text-xs tracking-wide text-muted uppercase">By type</p>

			<ul class="mt-3 flex flex-col gap-2.5">
				{#each byType as entry (entry.type)}
					<li class="flex items-center gap-3">
						<span class="w-32 shrink-0 truncate text-sm">{entry.type}</span>

						<span class="h-2 min-w-0 flex-1 rounded-full bg-white/8">
							<span
								style="width: {(entry.count / totals.all) * 100}%"
								class="block h-2 rounded-full bg-red-500"
							></span>
						</span>

						<span class="w-8 shrink-0 text-right text-sm text-muted">{entry.count}</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{/if}
