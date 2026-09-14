<script lang="ts">
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Siren from '@lucide/svelte/icons/siren';
	import Pager from '$lib/components/Pager.svelte';
	import { exactTime, pageSlice, relativeTime } from '$lib/staff';
	import type { Infraction } from '$lib/server/staff';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const perPage = 10;

	let page = $state(1);

	const shown = $derived(pageSlice(data.infractions, page, perPage));

	const counts = $derived({
		total: data.infractions.length,
		active: data.infractions.filter((entry) => !entry.revoked && !entry.escalated).length,
		revoked: data.infractions.filter((entry) => entry.revoked).length,
		escalated: data.infractions.filter((entry) => entry.escalated).length
	});

	function status(entry: Infraction): { label: string; tone: string } {
		if (entry.revoked) return { label: 'Revoked', tone: 'text-muted' };
		if (entry.escalated) return { label: 'Escalated', tone: 'text-yellow-400' };

		return { label: 'Active', tone: 'text-red-400' };
	}
</script>

<svelte:head><title>Your Infractions - {data.guild.name}</title></svelte:head>

<section class="mx-auto max-w-3xl px-6 py-16">
	<div class="flex items-center gap-4">
		{#if data.guild.iconUrl}
			<img src={data.guild.iconUrl} alt="" class="h-12 w-12 shrink-0 rounded-xl object-cover" />
		{:else}
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-line text-sm font-semibold"
			>
				{data.guild.name.slice(0, 2).toUpperCase()}
			</div>
		{/if}

		<div class="min-w-0">
			<p class="truncate text-xs text-muted">{data.guild.name}</p>
			<h1 class="mt-0.5 text-2xl font-bold tracking-[-0.02em]">Your Infractions</h1>
		</div>
	</div>

	<p class="mt-3 text-muted">Every infraction this server has issued against your staff record.</p>

	{#snippet tile(label: string, value: number)}
		<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
			<p class="text-xs tracking-wide text-muted uppercase">{label}</p>
			<p class="mt-1 text-2xl font-semibold">{value}</p>
		</div>
	{/snippet}

	<div class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
		{@render tile('Total', counts.total)}
		{@render tile('Active', counts.active)}
		{@render tile('Revoked', counts.revoked)}
		{@render tile('Escalated', counts.escalated)}
	</div>

	<div class="mt-6 rounded-xl border border-line bg-surface">
		<div class="flex items-center gap-2 border-b border-line px-6 py-4">
			<Siren class="h-4 w-4 text-muted" />
			<h2 class="text-sm font-semibold">Record</h2>
		</div>

		{#if !data.infractions.length}
			<div class="flex flex-col items-center px-6 py-12 text-center">
				<div
					class="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
				>
					<ShieldCheck class="h-5 w-5 text-green-400" />
				</div>
				<p class="mt-4 text-sm font-medium">You have a clean record in this server.</p>
				<p class="mt-1 text-sm text-muted">No infractions have been issued against you.</p>
			</div>
		{:else}
			<ul class="divide-y divide-line">
				{#each shown as entry (entry.id)}
					{@const state_ = status(entry)}
					<li class="px-6 py-4">
						<div class="flex items-center gap-2">
							<span
								class="rounded-full border border-line bg-white/5 px-2 py-0.5 text-[11px] font-medium"
							>
								{entry.type}
							</span>
							<span class="text-xs font-medium {state_.tone}">{state_.label}</span>
							<span class="ml-auto shrink-0 text-xs text-muted">{exactTime(entry.timestamp)}</span>
						</div>

						<p class="mt-2 text-sm whitespace-pre-wrap">{entry.reason}</p>
						<p class="mt-1.5 text-xs text-muted">
							by {entry.issuer || 'Unknown'}
							{#if entry.revokedAt}
								&middot; revoked {relativeTime(entry.revokedAt)}
							{/if}
						</p>
					</li>
				{/each}
			</ul>

			<Pager total={data.infractions.length} {perPage} label="infractions" bind:page />
		{/if}
	</div>
</section>
