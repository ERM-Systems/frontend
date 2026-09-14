<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Search from '@lucide/svelte/icons/search';
	import { resolve } from '$app/paths';
	import Meta from '$lib/components/Meta.svelte';
	import ShardGrid from '$lib/components/ShardGrid.svelte';
	import type { PageData } from './$types';
	import type { Status } from '../+layout.server';

	let { data }: { data: PageData } = $props();

	let query = $state('');

	let status = $state<Status | null>(null);

	$effect(() => {
		const incoming = Promise.resolve(data.status);
		let active = true;
		incoming.then((value) => active && (status = value));
		return () => {
			active = false;
		};
	});

	const loading = $derived(!status);
	const list = $derived(status?.list ?? []);

	const live = $derived(list.filter((shard) => shard.ping > 0).map((shard) => shard.ping));

	const stats = $derived([
		{ label: 'Lowest ping', value: live.length ? `${Math.round(Math.min(...live))}ms` : '-' },
		{
			label: 'Average ping',
			value: live.length
				? `${Math.round(live.reduce((sum, ping) => sum + ping, 0) / live.length)}ms`
				: '-'
		},
		{ label: 'Highest ping', value: live.length ? `${Math.round(Math.max(...live))}ms` : '-' },
		{ label: 'Shards online', value: list.length ? `${live.length}/${list.length}` : '-' }
	]);

	let match = $state<number | null>(null);
	let searching = $state(false);

	$effect(() => {
		const id = query.trim();
		if (!id) {
			match = null;
			searching = false;
			return;
		}

		searching = true;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await fetch(`/status/lookup?id=${encodeURIComponent(id)}`, {
					signal: controller.signal
				});
				match = ((await response.json()) as { shard: number | null }).shard;
				searching = false;
			} catch (error) {
				if (!(error instanceof DOMException && error.name === 'AbortError')) {
					searching = false;
				}
			}
		}, 350);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});
</script>

<Meta
	title="Shard Status - ERM Systems"
	description="Live shard health and uptime for the ERM Systems bot."
/>

<section class="mx-auto max-w-350 px-6 py-16">
	<div class="flex flex-wrap items-center gap-4">
		<h1 class="text-4xl font-bold tracking-[-0.03em]">Shard Status</h1>

		<a
			href={resolve('/status/redirect')}
			target="_blank"
			rel="noopener"
			aria-label="Service status"
			class="ml-auto flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/8 sm:px-4 pointer-coarse:py-3"
		>
			<span class="hidden sm:inline">Service status</span>
			<ExternalLink class="h-4 w-4" />
		</a>
	</div>

	<p class="mt-3 text-muted">Live latency for every shard ERM is running.</p>

	<div class="mt-10 grid items-start gap-6 lg:grid-cols-[1fr_320px]">
		{#if loading}
			<ShardGrid shards={[]} loading />
		{:else}
			<ShardGrid shards={list} highlight={match} />
		{/if}

		<aside class="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
			<div class="rounded-xl border border-line bg-surface p-4">
				<label for="server-id" class="text-sm font-medium">Find a server</label>

				<div class="mt-3 flex items-center gap-2 rounded-lg border border-line bg-bg px-3">
					<Search class="h-4 w-4 shrink-0 text-muted" />
					<input
						id="server-id"
						bind:value={query}
						inputmode="numeric"
						placeholder="Server ID"
						class="w-full border-0 bg-transparent px-0 py-2.5 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
					/>
				</div>

				{#if query.trim()}
					{#if searching}
						<p class="mt-3 text-sm text-muted">Searching...</p>
					{:else}
						<p class="mt-3 text-sm {match === null ? 'text-red-400' : 'text-green-400'}">
							{match === null ? 'Server not found' : `On shard ${match}`}
						</p>
					{/if}
				{/if}
			</div>

			<dl class="divide-y divide-line rounded-xl border border-line bg-surface">
				{#each stats as stat (stat.label)}
					<div class="flex items-center justify-between px-4 py-3">
						<dt class="text-sm text-muted">{stat.label}</dt>
						<dd class="text-sm font-semibold">{stat.value}</dd>
					</div>
				{/each}
			</dl>
		</aside>
	</div>
</section>
