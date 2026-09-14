<script lang="ts">
	import Activity from '@lucide/svelte/icons/activity';
	import Car from '@lucide/svelte/icons/car';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Globe from '@lucide/svelte/icons/globe';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Gavel from '@lucide/svelte/icons/gavel';
	import Search from '@lucide/svelte/icons/search';
	import Shield from '@lucide/svelte/icons/shield';
	import Users from '@lucide/svelte/icons/users';
	import { fade, fly } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Meta from '$lib/components/Meta.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { counter } from '$lib/counter.svelte';
	import { tint, type OverviewLink } from '$lib/serverOverview';
	import type { LiveJoin, MyRecord, OverviewLive } from '$lib/server/overview';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let live = $derived<OverviewLive>(data.live);
	let stale = $state(false);
	let now = $state(Date.now());
	let query = $state('');

	const accent = $derived(data.settings.accent);

	const reachable = $derived(live.status === 'ok');
	const online = $derived(reachable && live.currentPlayers > 0);

	const settled = $derived(live.status === 'unconfigured');

	const capacity = $derived(
		live.maxPlayers > 0
			? Math.min(100, Math.round((live.currentPlayers / live.maxPlayers) * 100))
			: 0
	);

	const players = counter(() => live.currentPlayers);
	const staff = counter(() => live.staff);
	const queue = counter(() => live.queue);
	const vehicles = counter(() => live.vehicleCount);

	const tiles = $derived([
		{
			icon: Users,
			label: 'Players Online',
			value: players.current,
			hint: live.maxPlayers ? `of ${live.maxPlayers}` : ''
		},
		{ icon: Shield, label: 'Staff In Game', value: staff.current, hint: '' },
		{ icon: Hourglass, label: 'In Queue', value: queue.current, hint: '' },
		{ icon: Car, label: 'Vehicles Spawned', value: vehicles.current, hint: '' }
	]);

	const flashMs = 3500;

	let flashes = $state<Record<string, number>>({});
	let pruning: ReturnType<typeof setTimeout> | null = null;

	function joinId(entry: LiveJoin): string {
		return `${entry.id}-${entry.timestamp}-${entry.join}`;
	}

	function flash(keys: string[]) {
		if (!keys.length) return;

		const at = Date.now();
		const next = { ...flashes };
		for (const key of keys) next[key] = at;
		flashes = next;

		if (pruning) clearTimeout(pruning);
		pruning = setTimeout(() => {
			const cutoff = Date.now() - flashMs;
			flashes = Object.fromEntries(Object.entries(flashes).filter(([, when]) => when > cutoff));
			pruning = null;
		}, flashMs + 100);
	}

	let primed = false;

	function apply(value: OverviewLive) {
		if (primed) {
			const seenPlayers = new Set(live.players.map((player) => player.id));
			const seenJoins = new Set(live.joinLogs.map(joinId));
			const seenTeams = new Map(live.teams.map((team) => [team.name, team.count]));

			flash([
				...value.players
					.filter((player) => !seenPlayers.has(player.id))
					.map((player) => `player:${player.id}`),
				...value.joinLogs
					.filter((entry) => !seenJoins.has(joinId(entry)))
					.map((entry) => `join:${joinId(entry)}`),
				...value.teams
					.filter((team) => seenTeams.get(team.name) !== team.count)
					.map((team) => `team:${team.name}`)
			]);
		}

		primed = true;
		live = value;
		stale = false;
	}

	$effect(() => {
		const clock = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(clock);
	});

	$effect(() => {
		if (settled) return;

		const source = new EventSource(`/api/overview/${data.guild.id}/stream`);

		source.addEventListener('snapshot', (event) => {
			try {
				apply(JSON.parse((event as MessageEvent).data) as OverviewLive);
			} catch {
				stale = true;
			}
		});

		source.onerror = () => (stale = true);

		return () => {
			primed = false;
			source.close();
		};
	});

	const updated = $derived(Math.max(0, Math.round((now - live.fetchedAt) / 1000)));

	function ago(timestamp: number): string {
		const diff = Math.max(0, Math.floor(now / 1000) - timestamp);
		if (diff < 60) return `${diff}s ago`;
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86_400)}d ago`;
	}

	const teamColors: Record<string, string> = {
		Civilian: '#8b8b8b',
		Police: '#3b82f6',
		Sheriff: '#eab308',
		Fire: '#f03232',
		DOT: '#f97316',
		Jail: '#8b5cf6'
	};

	const permissionTones: Record<string, string> = {
		'Server Owner': 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
		'Server Co-Owner': 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
		'Server Administrator': 'border-red-400/30 bg-red-400/10 text-red-300',
		'Server Moderator': 'border-blue-400/30 bg-blue-400/10 text-blue-300'
	};

	let teamFilter = $state('');

	const teamOptions = $derived([
		{ value: '', label: 'All teams' },
		...live.teams.map((team) => ({
			value: team.name,
			label: `${team.name} (${team.count})`
		}))
	]);

	const roster = $derived.by(() => {
		const term = query.trim().toLowerCase();

		const matched = live.players.filter(
			(player) =>
				(!teamFilter || player.team === teamFilter) &&
				(!term ||
					player.name.toLowerCase().includes(term) ||
					player.team.toLowerCase().includes(term) ||
					player.permission.toLowerCase().includes(term))
		);

		return [...matched].sort(
			(a, b) =>
				Number(b.permission !== 'Normal') - Number(a.permission !== 'Normal') ||
				a.name.localeCompare(b.name)
		);
	});

	const busiest = $derived(Math.max(1, ...live.teams.map((team) => team.count)));
	const teamTotal = $derived(live.teams.reduce((sum, team) => sum + team.count, 0));

	let teamMode = $state<'count' | 'percent'>('count');

	function teamValue(count: number): string {
		if (teamMode === 'count') return String(count);
		return `${teamTotal ? Math.round((count / teamTotal) * 100) : 0}%`;
	}

	const description = $derived(
		data.settings.tagline ||
			data.guild.description ||
			`Live player counts, staff and activity for ${data.guild.name}.`
	);

	const banner = $derived(data.settings.banner || data.guild.bannerUrl);

	let leaving = $state<OverviewLink | null>(null);

	function guard(event: MouseEvent, link: OverviewLink) {
		if (new URL(link.url).host === page.url.host) return;

		event.preventDefault();
		leaving = link;
	}

	const social = $derived(data.guild.iconUrl || banner);

	const signedIn = $derived(!!page.data.signedIn);

	let record = $state<MyRecord | null>(null);
	let recordState = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');

	$effect(() => {
		if (!data.settings.panels.moderations || !signedIn) return;

		let active = true;
		recordState = 'loading';

		fetch(`/api/overview/${data.guild.id}/moderations`)
			.then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
			.then((value: MyRecord) => {
				if (!active) return;
				record = value;
				recordState = 'ready';
			})
			.catch(() => active && (recordState = 'error'));

		return () => {
			active = false;
		};
	});

	function stamp(epoch: number): string {
		if (!epoch) return 'Unknown date';
		return new Date(epoch * 1000).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	const moderationTones: Record<string, string> = {
		Warning: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
		Kick: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
		Ban: 'border-red-400/30 bg-red-400/10 text-red-300',
		BOLO: 'border-violet-400/30 bg-violet-400/10 text-violet-300'
	};

	const preview = 3;
	const entries = $derived(record?.moderations ?? []);
	const hidden = $derived(Math.max(0, entries.length - preview));
</script>

<Meta
	title="{data.guild.name} | ERM Server Overview"
	{description}
	image={social}
	wide={!!social}
/>

<svelte:head><meta name="theme-color" content={accent} /></svelte:head>

<div class="relative">
	<div
		class="pointer-events-none absolute inset-x-0 -top-14 h-110"
		style="background: linear-gradient(to bottom, {tint(accent, 0.18)}, transparent)"
	></div>

	<div class="relative mx-auto max-w-350 px-6 py-10">
		<header
			class="overflow-hidden rounded-2xl border border-line bg-surface"
			in:fly={{ y: 12, duration: 320 }}
		>
			<div class="relative h-40 sm:h-52">
				{#if banner}
					<img src={banner} alt="" class="h-full w-full object-cover" />
				{:else}
					<div
						class="h-full w-full"
						style="background: linear-gradient(135deg, {tint(accent, 0.5)}, {tint(accent, 0.08)})"
					></div>
				{/if}

				<div
					class="absolute inset-0"
					style="background: linear-gradient(to top, var(--color-surface), {tint(accent, 0.15)})"
				></div>
			</div>

			<div
				class="flex flex-col items-start gap-4 px-6 pb-6 sm:flex-row sm:flex-wrap sm:items-end sm:gap-5 sm:px-8"
			>
				<div class="relative z-10 -mt-14 shrink-0">
					{#if data.guild.iconUrl}
						<img
							src={data.guild.iconUrl}
							alt=""
							class="h-24 w-24 rounded-2xl border-4 border-surface object-cover sm:h-28 sm:w-28"
						/>
					{:else}
						<div
							class="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-surface bg-line text-2xl font-bold sm:h-28 sm:w-28"
						>
							{data.guild.name.slice(0, 2).toUpperCase()}
						</div>
					{/if}
				</div>

				<div class="w-full min-w-0 sm:flex-1">
					<div class="flex flex-wrap items-center gap-3">
						<h1 class="text-3xl leading-none font-bold tracking-[-0.03em]">{data.guild.name}</h1>

						<span
							class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium {online
								? 'border-green-400/30 bg-green-400/10 text-green-300'
								: 'border-line bg-white/5 text-muted'}"
						>
							<span
								class="h-1.5 w-1.5 rounded-full {online
									? 'animate-pulse bg-green-400'
									: 'bg-muted'}"
							></span>
							{online ? 'Online' : 'Offline'}
						</span>
					</div>

					<p class="mt-2 max-w-2xl text-sm text-muted">{description}</p>
				</div>

				<div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
					{#each data.settings.links as link (link.url)}
						<a
							href={link.url}
							onclick={(event) => guard(event, link)}
							rel="noreferrer noopener nofollow"
							target="_blank"
							class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
						>
							{link.label}
							<ExternalLink class="h-4 w-4 text-muted" />
						</a>
					{/each}

					{#if data.settings.panels.priorities}
						<a
							href={resolve('/[guildID]/request', { guildID: data.guild.id })}
							class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
						>
							Request a priority
						</a>
					{/if}

					{#if live.joinKey && reachable}
						<a
							href="https://erlc.gg/join/{live.joinKey}"
							rel="noreferrer noopener"
							target="_blank"
							class="inline-flex shrink-0 items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] pointer-coarse:py-3"
							style="background: linear-gradient(135deg, {tint(accent, 0.95)}, {tint(
								accent,
								0.65
							)})"
						>
							Join Server
							<ExternalLink class="h-4 w-4" />
						</a>
					{/if}
				</div>
			</div>
		</header>

		{#if !reachable}
			<div
				class="mt-6 flex items-start gap-3 rounded-xl border border-line bg-surface px-5 py-4"
				in:fade={{ duration: 200 }}
			>
				<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
				<div class="min-w-0">
					<p class="text-sm font-medium">Live data is not available</p>
					<p class="mt-1 text-sm text-muted">{live.message}</p>
				</div>
			</div>
		{/if}

		<div
			class="mt-6 grid grid-cols-2 divide-line overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-4 sm:divide-x"
			in:fly={{ y: 10, duration: 260 }}
		>
			{#each tiles as tile (tile.label)}
				<div
					class="relative flex items-stretch gap-2.5 overflow-hidden px-3 py-3 sm:gap-3 sm:px-5 sm:py-4"
				>
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-lg border border-line"
						style="background: {tint(accent, 0.12)}"
					>
						<tile.icon class="h-4 w-4" style="color: {accent}" />
					</div>

					<div class="flex min-w-0 flex-1 flex-col justify-between gap-1">
						<p class="text-xs text-muted">{tile.label}</p>
						<p class="flex items-baseline gap-1.5 whitespace-nowrap">
							<span class="text-2xl font-bold tracking-tight tabular-nums">{tile.value}</span>
							{#if tile.hint}
								<span class="text-xs text-muted">{tile.hint}</span>
							{/if}
						</p>
					</div>

					{#if tile.label === 'Players Online' && live.maxPlayers}
						<div class="absolute inset-x-0 bottom-0 h-0.5 bg-white/8">
							<div
								class="h-full transition-[width] duration-700 ease-out"
								style="width: {capacity}%; background: {accent}"
							></div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<div class="mt-6 grid items-start gap-6 lg:grid-cols-3">
			{#if data.settings.panels.players}
				<section class="rounded-xl border border-line bg-surface lg:col-span-2">
					<div class="flex flex-wrap items-center gap-4 border-b border-line px-6 py-4">
						<div class="min-w-0 flex-1">
							<h2 class="text-sm font-semibold">Players</h2>
							<p class="mt-1 text-sm text-muted">
								{live.players.length}
								{live.players.length === 1 ? 'person' : 'people'} in the server right now.
							</p>
						</div>

						{#if live.players.length}
							<div class="flex w-full shrink-0 gap-2 sm:w-96">
								<div
									class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-white/5 px-3"
								>
									<Search class="h-4 w-4 shrink-0 text-muted" />
									<input
										bind:value={query}
										placeholder="Search players"
										aria-label="Search players"
										autocomplete="off"
										class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
									/>
								</div>

								<div class="w-40 shrink-0">
									<Select options={teamOptions} bind:value={teamFilter} placeholder="All teams" />
								</div>
							</div>
						{/if}
					</div>

					<ul class="max-h-136 divide-y divide-line overflow-y-auto">
						{#each roster as player (player.id)}
							<li
								class="flex items-center gap-3 px-6 py-3"
								class:flash={!!flashes['player:' + player.id]}
							>
								<Tooltip text={player.team}>
									<span
										class="h-2 w-2 shrink-0 rounded-full"
										style="background: {teamColors[player.team] ?? teamColors.Civilian}"
									></span>
								</Tooltip>

								<span class="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>

								<span class="shrink-0 text-xs text-muted">{player.team}</span>

								{#if player.permission !== 'Normal'}
									<span
										class="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium {permissionTones[
											player.permission
										] ?? 'border-line bg-white/5 text-muted'}"
									>
										{player.permission.replace('Server ', '')}
									</span>
								{/if}
							</li>
						{:else}
							<li class="px-6 py-12 text-center text-sm text-muted">
								{#if query || teamFilter}
									No players match those filters.
								{:else}
									Nobody is in the server right now.
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<div class="flex flex-col gap-6">
				{#if data.settings.panels.moderations}
					<section class="rounded-xl border border-line bg-surface">
						<div class="flex items-center gap-2 border-b border-line px-6 py-4">
							<Gavel class="h-4 w-4 text-muted" />
							<h2 class="text-sm font-semibold">Your Record</h2>
						</div>

						{#if !signedIn}
							<div class="px-6 py-6 text-center">
								<p class="text-sm text-muted">
									Sign in to see any moderations this server has issued against you.
								</p>
								<a
									href={resolve('/login')}
									class="mt-4 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
								>
									Sign in
								</a>
							</div>
						{:else if recordState === 'loading'}
							<div class="flex flex-col gap-3 px-6 py-5">
								{#each [0, 1] as row (row)}
									<div class="skeleton">
										<div class="h-3.5 w-24 rounded bg-white/10"></div>
										<div class="mt-2 h-3 w-40 rounded bg-white/8"></div>
									</div>
								{/each}
							</div>
						{:else if recordState === 'error'}
							<p class="px-6 py-8 text-center text-sm text-muted">
								Your record could not be loaded right now.
							</p>
						{:else if record && !record.linked}
							<p class="px-6 py-8 text-center text-sm text-muted">
								Link your Roblox account to ERM to see your record here.
							</p>
						{:else if entries.length}
							<ul class="divide-y divide-line">
								{#each entries.slice(0, preview) as entry (entry.id)}
									<li class="px-6 py-3">
										<div class="flex items-center gap-2">
											<span
												class="rounded-full border px-2 py-0.5 text-[11px] font-medium {moderationTones[
													entry.type
												] ?? 'border-line bg-white/5 text-muted'}"
											>
												{entry.type}
											</span>
											<span class="ml-auto shrink-0 text-xs text-muted">{stamp(entry.epoch)}</span>
										</div>

										<p class="mt-1.5 line-clamp-2 text-sm">{entry.reason}</p>
										<p class="mt-1 text-xs text-muted">by {entry.moderator}</p>
									</li>
								{/each}
							</ul>

							<div class="border-t border-line px-6 py-3">
								<a
									href={resolve('/[guildID]/logs', { guildID: data.guild.id })}
									class="block w-full rounded-lg border border-line px-3 py-2 text-center text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
								>
									View full record{hidden ? ` (${entries.length})` : ''}
								</a>
							</div>
						{:else}
							<p class="px-6 py-8 text-center text-sm text-muted">
								You have a clean record in this server.
							</p>
						{/if}
					</section>
				{/if}

				{#if data.settings.panels.teams}
					<section class="rounded-xl border border-line bg-surface">
						<div class="flex items-center gap-4 border-b border-line px-6 py-4">
							<div class="min-w-0 flex-1">
								<h2 class="text-sm font-semibold">Team Split</h2>
								<p class="mt-1 text-sm text-muted">Where everyone is playing.</p>
							</div>

							<div class="flex shrink-0 rounded-lg border border-line p-0.5">
								{#each [{ key: 'count', label: '#' }, { key: 'percent', label: '%' }] as mode (mode.key)}
									<button
										type="button"
										onclick={() => (teamMode = mode.key as 'count' | 'percent')}
										aria-pressed={teamMode === mode.key}
										aria-label={mode.key === 'count' ? 'Show counts' : 'Show percentages'}
										class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors pointer-coarse:min-w-11 pointer-coarse:px-3.5 pointer-coarse:py-3.5 {teamMode ===
										mode.key
											? 'bg-white/10 text-white'
											: 'text-muted hover:text-white'}"
									>
										{mode.label}
									</button>
								{/each}
							</div>
						</div>

						<div class="flex flex-col gap-3 px-6 py-5">
							{#each live.teams as team (team.name)}
								<div
									class="-mx-2 rounded-md px-2 py-1"
									class:flash={!!flashes['team:' + team.name]}
								>
									<p class="flex items-center justify-between text-sm">
										<span>{team.name}</span>
										<span class="text-muted tabular-nums">{teamValue(team.count)}</span>
									</p>
									<div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
										<div
											class="h-full rounded-full transition-[width] duration-500"
											style="width: {(team.count / busiest) * 100}%; background: {teamColors[
												team.name
											] ?? teamColors.Civilian}"
										></div>
									</div>
								</div>
							{:else}
								<p class="py-6 text-center text-sm text-muted">No teams to show.</p>
							{/each}
						</div>
					</section>
				{/if}

				{#if data.settings.panels.activity}
					<section class="rounded-xl border border-line bg-surface">
						<div class="flex items-center gap-2 border-b border-line px-6 py-4">
							<Activity class="h-4 w-4 text-muted" />
							<h2 class="text-sm font-semibold">Join Activity</h2>
						</div>

						<ul class="divide-y divide-line">
							{#each live.joinLogs as entry, index (`${entry.id}-${entry.timestamp}-${index}`)}
								<li
									class="flex items-center gap-2 px-6 py-2.5 text-sm"
									class:flash={!!flashes['join:' + joinId(entry)]}
								>
									<span
										class="h-1.5 w-1.5 shrink-0 rounded-full {entry.join
											? 'bg-green-400'
											: 'bg-red-400'}"
									></span>
									<span class="min-w-0 flex-1 truncate">
										<span class="font-medium">{entry.name}</span>
										<span class="text-muted">{entry.join ? 'joined' : 'left'}</span>
									</span>
									<span class="shrink-0 text-xs text-muted">{ago(entry.timestamp)}</span>
								</li>
							{:else}
								<li class="px-6 py-10 text-center text-sm text-muted">No recent activity.</li>
							{/each}
						</ul>
					</section>
				{/if}

				{#if data.settings.panels.vehicles}
					<section class="rounded-xl border border-line bg-surface">
						<div class="flex items-center gap-2 border-b border-line px-6 py-4">
							<Car class="h-4 w-4 text-muted" />
							<h2 class="text-sm font-semibold">Vehicles</h2>
						</div>

						<ul class="max-h-80 divide-y divide-line overflow-y-auto">
							{#each live.vehicles as vehicle, index (`${vehicle.owner}-${vehicle.name}-${index}`)}
								<li class="px-6 py-2.5">
									<p class="truncate text-sm font-medium">{vehicle.name}</p>
									<p class="mt-0.5 truncate text-xs text-muted">
										{vehicle.owner}{vehicle.texture ? ` - ${vehicle.texture}` : ''}
									</p>
								</li>
							{:else}
								<li class="px-6 py-10 text-center text-sm text-muted">No vehicles spawned.</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>
		</div>

		{#if !settled}
			<p class="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
				<span
					class="h-1.5 w-1.5 rounded-full {stale ? 'bg-yellow-400' : 'animate-pulse bg-green-400'}"
				></span>
				{#if stale}
					Could not refresh, retrying shortly
				{:else}
					Updated {updated < 5 ? 'just now' : `${updated}s ago`}
				{/if}
			</p>
		{/if}
	</div>
</div>

{#if leaving}
	{@const target = leaving}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="button"
		tabindex="-1"
		aria-label="Stay on this page"
		onclick={() => (leaving = null)}
		onkeydown={(event) => event.key === 'Enter' && (leaving = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-line bg-surface"
		role="dialog"
		aria-modal="true"
		aria-label="Leaving this page"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<div class="flex flex-col items-center px-6 pt-8 text-center">
			<span
				class="flex h-12 w-12 items-center justify-center rounded-full border border-yellow-400/25 bg-yellow-400/10"
			>
				<TriangleAlert class="h-5 w-5 text-yellow-400" />
			</span>

			<h2 class="mt-4 text-lg font-semibold">You are leaving this page</h2>
			<p class="mt-2 text-sm text-muted">
				{data.guild.name} added this link. We do not control where it goes, so only continue if you trust
				it.
			</p>
		</div>

		<div
			class="mx-6 mt-5 flex items-center gap-3 rounded-xl border border-line bg-white/5 px-4 py-3"
		>
			<Globe class="h-4 w-4 shrink-0 text-muted" />
			<div class="min-w-0">
				<p class="truncate text-sm font-semibold">{new URL(target.url).hostname}</p>
				<p class="truncate text-xs text-muted">{target.url}</p>
			</div>
		</div>

		<div class="mt-6 flex gap-2 border-t border-line bg-white/2 px-6 py-4">
			<button
				type="button"
				onclick={() => (leaving = null)}
				class="flex-1 rounded-lg border border-line px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Stay here
			</button>

			<a
				href={target.url}
				rel="noreferrer noopener nofollow"
				target="_blank"
				onclick={() => (leaving = null)}
				class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
				style="background: linear-gradient(135deg, {tint(accent, 0.95)}, {tint(accent, 0.65)})"
			>
				Continue
				<ExternalLink class="h-4 w-4" />
			</a>
		</div>
	</div>
{/if}

<svelte:window
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;
		leaving = null;
	}}
/>

<style>
	@keyframes flash-fade {
		0% {
			background-color: rgba(59, 130, 246, 0);
		}
		10% {
			background-color: rgba(59, 130, 246, 0.13);
		}
		78% {
			background-color: rgba(59, 130, 246, 0.13);
		}
		100% {
			background-color: rgba(59, 130, 246, 0);
		}
	}

	.flash {
		animation: flash-fade 3.5s ease-in-out forwards;
	}

	@media (prefers-reduced-motion: reduce) {
		.flash {
			animation: none;
		}
	}
</style>
