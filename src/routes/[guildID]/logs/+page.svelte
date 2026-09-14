<script lang="ts">
	import Gavel from '@lucide/svelte/icons/gavel';
	import Search from '@lucide/svelte/icons/search';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const pollInterval = 20_000;

	let live = $state<PageData['record']>(null);
	let streaming = $state(false);

	const guildId = $derived(data.guild.id);
	const record = $derived(live ?? data.record);
	const entries = $derived(record?.moderations ?? []);

	$effect(() => {
		const id = guildId;
		if (!untrack(() => data.signedIn && data.record?.linked)) return;

		const source = new EventSource(`/api/logs/${id}/stream`);
		let poll: ReturnType<typeof setInterval> | null = null;

		source.addEventListener('record', (event) => {
			try {
				live = JSON.parse((event as MessageEvent).data) as PageData['record'];
			} catch {
				live = null;
			}
		});

		source.onopen = () => {
			streaming = true;
			if (poll) clearInterval(poll);
			poll = null;
		};

		source.onerror = () => {
			streaming = false;
			live = null;
			if (poll) return;

			poll = setInterval(() => {
				if (!document.hidden) void invalidateAll();
			}, pollInterval);
		};

		return () => {
			source.close();
			streaming = false;
			if (poll) clearInterval(poll);
		};
	});

	let query = $state('');
	let type = $state('');

	const types = $derived([...new Set(entries.map((entry) => entry.type))].sort());

	const filtered = $derived.by(() => {
		const term = query.trim().toLowerCase();

		return entries.filter(
			(entry) =>
				(!type || entry.type === type) &&
				(!term ||
					entry.reason.toLowerCase().includes(term) ||
					entry.moderator.toLowerCase().includes(term) ||
					entry.type.toLowerCase().includes(term))
		);
	});

	const tones: Record<string, string> = {
		Warning: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
		Kick: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
		Ban: 'border-red-400/30 bg-red-400/10 text-red-300',
		'Temporary Ban': 'border-red-400/30 bg-red-400/10 text-red-300',
		BOLO: 'border-violet-400/30 bg-violet-400/10 text-violet-300'
	};

	function stamp(epoch: number): string {
		if (!epoch) return 'Unknown date';
		return new Date(epoch * 1000).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head><title>Your Logs - {data.guild.name}</title></svelte:head>

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
			<h1 class="mt-0.5 text-2xl font-bold tracking-[-0.02em]">Your Moderation Logs</h1>
		</div>
	</div>

	<p class="mt-3 text-muted">Every moderation this server has issued against your account.</p>

	<div class="mt-8 rounded-xl border border-line bg-surface">
		<div class="flex items-center gap-2 border-b border-line px-6 py-4">
			<Gavel class="h-4 w-4 text-muted" />
			<h2 class="text-sm font-semibold">Record</h2>
			{#if data.signedIn && record?.linked && entries.length}
				<span class="ml-auto text-xs text-muted">
					{entries.length}
					{entries.length === 1 ? 'entry' : 'entries'}
				</span>
			{/if}

			{#if streaming}
				<span
					class="flex shrink-0 items-center gap-1.5 text-xs text-green-500 {entries.length
						? ''
						: 'ml-auto'}"
				>
					<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
					Live
				</span>
			{/if}
		</div>

		{#if !data.signedIn}
			<div class="px-6 py-10 text-center">
				<p class="text-sm text-muted">
					Sign in to see any moderations this server has issued against you.
				</p>
				<a
					href={resolve('/login')}
					data-sveltekit-reload
					class="mt-4 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
				>
					Sign in
				</a>
			</div>
		{:else if !record}
			<p class="px-6 py-10 text-center text-sm text-muted">
				Your logs could not be loaded right now, try again shortly.
			</p>
		{:else if !record.linked}
			<div class="px-6 py-10 text-center">
				<p class="text-sm text-muted">Link your Roblox account to ERM to see your logs here.</p>
				<p class="mt-2 text-xs text-muted">
					Run <span class="rounded bg-white/8 px-1.5 py-0.5 font-mono text-white">/link</span> with the
					ERM bot in a server or in its DMs, then reload this page.
				</p>
			</div>
		{:else if !entries.length}
			<div class="flex flex-col items-center px-6 py-12 text-center">
				<div
					class="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
				>
					<ShieldCheck class="h-5 w-5 text-green-400" />
				</div>
				<p class="mt-4 text-sm font-medium">You have a clean record in this server.</p>
				<p class="mt-1 text-sm text-muted">No moderations have been issued against you.</p>
			</div>
		{:else}
			<div class="flex flex-col gap-3 border-b border-line px-6 py-5 sm:flex-row">
				<div class="relative min-w-0 flex-1">
					<Search
						class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
					/>
					<input
						bind:value={query}
						placeholder="Search reason, moderator or type"
						aria-label="Search logs"
						class="min-h-10 w-full rounded-lg border border-line bg-white/5 py-2 pr-3 pl-10 text-sm placeholder:text-muted focus:border-white/25 focus:ring-0 pointer-coarse:min-h-11"
					/>
				</div>

				{#if types.length > 1}
					<select
						bind:value={type}
						aria-label="Filter by type"
						class="min-h-10 w-full shrink-0 rounded-lg border border-line bg-white/5 px-3 text-sm focus:border-white/25 focus:ring-0 sm:w-44 pointer-coarse:min-h-11"
					>
						<option value="">All types</option>
						{#each types as entry (entry)}
							<option value={entry}>{entry}</option>
						{/each}
					</select>
				{/if}
			</div>

			{#if filtered.length}
				<ul class="divide-y divide-line">
					{#each filtered as entry (entry.id)}
						<li class="px-6 py-4">
							<div class="flex items-center gap-2">
								<span
									class="rounded-full border px-2 py-0.5 text-[11px] font-medium {tones[
										entry.type
									] ?? 'border-line bg-white/5 text-muted'}"
								>
									{entry.type}
								</span>
								<span class="ml-auto shrink-0 text-xs text-muted">{stamp(entry.epoch)}</span>
							</div>

							<p class="mt-2 text-sm whitespace-pre-wrap">{entry.reason}</p>
							<p class="mt-1.5 text-xs text-muted">
								by {entry.moderator}
								{#if entry.untilEpoch}
									· until {stamp(entry.untilEpoch)}
								{/if}
							</p>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="px-6 py-10 text-center text-sm text-muted">Nothing matches those filters.</p>
			{/if}
		{/if}
	</div>
</section>
