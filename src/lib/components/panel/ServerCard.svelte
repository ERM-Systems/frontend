<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Shield from '@lucide/svelte/icons/shield';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Users from '@lucide/svelte/icons/users';
	import Car from '@lucide/svelte/icons/car';
	import Crown from '@lucide/svelte/icons/crown';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { counter } from '$lib/counter.svelte';
	import type { Panel } from '$lib/panelClient.svelte';

	let { panel }: { panel: Panel } = $props();

	const server = $derived(panel.snapshot.server);
	const reachable = $derived(server.status === 'ok');

	const players = counter(() => server.currentPlayers);
	const staff = counter(
		() => server.players.filter((player) => player.permission !== 'Normal').length
	);
	const queue = counter(() => server.queue);
	const vehicles = counter(() => server.vehicles.length);

	const capacity = $derived(
		server.maxPlayers > 0
			? Math.min(100, Math.round((server.currentPlayers / server.maxPlayers) * 100))
			: 0
	);

	const owners = $derived(server.owners ?? []);

	const tiles = $derived([
		{
			icon: Users,
			label: 'Players',
			value: players.current,
			hint: server.maxPlayers ? `of ${server.maxPlayers}` : ''
		},
		{ icon: Shield, label: 'Staff in game', value: staff.current, hint: '' },
		{ icon: Hourglass, label: 'In queue', value: queue.current, hint: '' },
		{ icon: Car, label: 'Vehicles', value: vehicles.current, hint: '' }
	]);
</script>

{#if !reachable}
	<div class="flex h-full flex-col items-center justify-center gap-3 px-5 py-8 text-center">
		<div
			class="flex h-10 w-10 items-center justify-center rounded-full border border-yellow-400/30 bg-yellow-400/10"
		>
			<TriangleAlert class="h-5 w-5 text-yellow-400" />
		</div>

		<div class="min-w-0">
			<p class="text-sm font-medium">Live data is not available</p>
			<p class="mx-auto mt-1 max-w-80 text-sm text-balance text-muted">{server.message}</p>
		</div>
	</div>
{:else}
	<div class="flex flex-wrap items-center gap-4 px-5 py-4">
		<div class="min-w-0 flex-1">
			<p class="truncate text-lg font-semibold tracking-tight">{server.name}</p>
			<div class="mt-1.5 h-1 w-full max-w-64 overflow-hidden rounded-full bg-white/8">
				<div
					class="h-full bg-red-500 transition-[width] duration-700 ease-out"
					style="width: {capacity}%"
				></div>
			</div>
		</div>

		{#if server.joinKey}
			<a
				href="https://erlc.gg/join/{server.joinKey}"
				rel="noreferrer noopener"
				target="_blank"
				class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				Join Server
				<ExternalLink class="h-4 w-4" />
			</a>
		{/if}
	</div>

	<div class="@container border-t border-line">
		<div class="grid grid-cols-2 divide-line @2xl:grid-cols-4 @2xl:divide-x">
			{#each tiles as tile (tile.label)}
				<div class="flex items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5"
					>
						<tile.icon class="h-4 w-4 text-muted" />
					</div>

					<div class="min-w-0">
						<p class="truncate text-xs text-muted">{tile.label}</p>
						<p class="flex items-baseline gap-1.5 whitespace-nowrap">
							<span class="text-2xl font-bold tracking-tight tabular-nums">{tile.value}</span>
							{#if tile.hint}
								<span class="text-xs text-muted">{tile.hint}</span>
							{/if}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</div>

	{#if owners.length}
		<div class="border-t border-line px-5 py-4">
			<p class="text-[11px] font-semibold tracking-wide text-muted uppercase">Server ownership</p>

			<ul class="mt-2.5 flex flex-wrap gap-2">
				{#each owners as owner (owner.id)}
					<li
						class="inline-flex items-center gap-2 rounded-full border border-line bg-white/5 py-1 pr-3 pl-2.5"
					>
						<Crown class="h-3.5 w-3.5 shrink-0 {owner.lead ? 'text-yellow-300' : 'text-muted'}" />

						<span class="max-w-40 truncate text-xs font-medium">{owner.name}</span>

						<span class="text-[11px] text-muted">{owner.lead ? 'Owner' : 'Co-owner'}</span>

						<Tooltip text={owner.inGame ? 'In game' : 'Not in game'}>
							<span
								class="block h-1.5 w-1.5 shrink-0 rounded-full {owner.inGame
									? 'animate-pulse bg-green-400'
									: 'bg-muted'}"
							></span>
						</Tooltip>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{/if}
