<script lang="ts">
	import Ban from '@lucide/svelte/icons/ban';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import Shield from '@lucide/svelte/icons/shield';
	import Users from '@lucide/svelte/icons/users';
	import X from '@lucide/svelte/icons/x';
	import { fade, scale } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import Select from '$lib/components/settings/Select.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import Filters from '$lib/components/panel/Filters.svelte';
	import { stamp, teamColors, type Panel } from '$lib/panelClient.svelte';
	import type { DiscordMatch, RobloxProfile } from '$lib/server/panel';
	import { teamNames } from '$lib/settings';
	import { toast } from '$lib/toast.svelte';

	let { panel }: { panel: Panel } = $props();

	let query = $state('');
	let team = $state('');
	let open = $state('');

	let profile = $state<RobloxProfile | null>(null);
	let loading = $state(false);

	let checked = $state<DiscordMatch[] | null>(null);
	let checking = $state(false);
	let viewing = $state(false);
	let checkQuery = $state('');
	let checkTeam = $state('');
	let staffFilter = $state('');
	let discordFilter = $state('');

	const staffOptions = [
		{ value: '', label: 'Everyone', icon: Shield },
		{ value: 'staff', label: 'Staff only' },
		{ value: 'normal', label: 'Non-staff' }
	];

	const discordOptions = [
		{ value: '', label: 'Any Discord status', icon: MessageCircle },
		{ value: 'missing', label: 'Not in Discord' },
		{ value: 'linked', label: 'In Discord' }
	];

	const outside = $derived(
		new Set((checked ?? []).filter((entry) => !entry.discordId).map((entry) => entry.name))
	);

	async function check() {
		checking = true;

		const response = await fetch(`${panel.base}?feed=discord`, { cache: 'no-store' }).catch(
			() => null
		);
		const body = response?.ok ? await response.json().catch(() => null) : null;
		const found = Array.isArray(body) ? (body as DiscordMatch[]) : null;

		checking = false;

		if (!found) {
			toast('The Discord check failed, try again in a few minutes.', 'error');
			return;
		}

		const absent = found.filter((entry) => !entry.discordId).length;

		checked = found;
		viewing = true;

		toast(
			absent
				? `${absent} player${absent === 1 ? ' is' : 's are'} not in the Discord server.`
				: 'Every player in game is in the Discord server.',
			absent ? 'error' : 'success'
		);
	}

	const checkTeams = $derived([
		{ value: '', label: 'All teams', icon: Users },
		...teamNames
			.map((name) => ({
				value: name,
				label: `${name} (${(checked ?? []).filter((entry) => entry.team === name).length})`
			}))
			.filter((option) => !option.label.endsWith('(0)'))
	]);

	const results = $derived.by(() => {
		const term = checkQuery.trim().toLowerCase();

		return (checked ?? []).filter(
			(entry) =>
				(!checkTeam || entry.team === checkTeam) &&
				(!staffFilter || (staffFilter === 'staff') === entry.staff) &&
				(!discordFilter || (discordFilter === 'missing') === !entry.discordId) &&
				(!term ||
					entry.name.toLowerCase().includes(term) ||
					entry.id.includes(term) ||
					entry.discordName.toLowerCase().includes(term) ||
					entry.discordId.includes(term))
		);
	});

	const permissionTones: Record<string, string> = {
		'Server Owner': 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
		'Server Co-Owner': 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
		'Server Administrator': 'border-red-400/30 bg-red-400/10 text-red-300',
		'Server Moderator': 'border-blue-400/30 bg-blue-400/10 text-blue-300'
	};

	const players = $derived(panel.snapshot.server.players);
	const active = $derived(players.find((player) => player.id === open));

	const priors = $derived.by(() => {
		const id = open;
		return id ? panel.snapshot.moderations.filter((entry) => entry.userId === id) : [];
	});

	const teamOptions = $derived([
		{ value: '', label: 'All teams' },
		...teamNames
			.map((name) => ({
				value: name,
				label: `${name} (${players.filter((player) => player.team === name).length})`
			}))
			.filter((option) => !option.label.endsWith('(0)'))
	]);

	const roster = $derived.by(() => {
		const term = query.trim().toLowerCase();

		return players
			.filter(
				(player) =>
					(!team || player.team === team) &&
					(!term ||
						player.name.toLowerCase().includes(term) ||
						player.team.toLowerCase().includes(term))
			)
			.toSorted(
				(a, b) =>
					Number(outside.has(b.name)) - Number(outside.has(a.name)) ||
					Number(b.permission !== 'Normal') - Number(a.permission !== 'Normal') ||
					a.name.localeCompare(b.name)
			);
	});

	$effect(() => {
		const id = open;
		if (!id) {
			profile = null;
			return;
		}

		let running = true;
		loading = true;
		profile = null;

		fetch(`${panel.base}?feed=profile&id=${encodeURIComponent(id)}`)
			.then((response) => (response.ok ? response.json() : null))
			.then((value: RobloxProfile | null) => running && (profile = value))
			.catch(() => running && (profile = null))
			.finally(() => running && (loading = false));

		return () => {
			running = false;
		};
	});

	const groups = $derived([
		{ label: 'Movement', commands: ['bring', 'teleport'] },
		{ label: 'State', commands: ['heal', 'respawn', 'refresh', 'kill'] },
		{ label: 'Enforcement', commands: ['wanted', 'unwanted', 'jail', 'unjail'] },
		{ label: 'Removal', commands: panel.canBan ? ['kick', 'ban'] : ['kick'] }
	]);

	const labels: Record<string, string> = {
		bring: 'Bring',
		teleport: 'Go to',
		heal: 'Heal',
		respawn: 'Respawn',
		refresh: 'Refresh',
		kill: 'Kill',
		wanted: 'Wanted',
		unwanted: 'Unwanted',
		jail: 'Jail',
		unjail: 'Unjail',
		kick: 'Kick',
		ban: 'Ban'
	};

	const danger = new Set(['kill', 'kick', 'ban']);

	const joined = $derived(
		profile?.created ? stamp(Math.floor(new Date(profile.created).getTime() / 1000)) : ''
	);
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;

		if (open) open = '';
		else viewing = false;
	}}
/>

<Filters
	bind:query
	bind:choice={team}
	placeholder="Search players"
	label="Search players"
	options={teamOptions}
	choiceLabel="All teams"
/>

<div class="flex items-center gap-3 border-b border-line px-5 py-3">
	<button
		type="button"
		disabled={checking}
		onclick={check}
		class="inline-flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
	>
		{#if checking}
			<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
		{/if}
		Discord check
	</button>

	{#if checked}
		<button
			type="button"
			onclick={() => (viewing = true)}
			class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
		>
			View results
		</button>
	{/if}
</div>

<ul class="divide-y divide-line">
	{#each roster as player (player.id)}
		<li class="flex items-center gap-4 px-5 py-3.5">
			<Tooltip text={player.team}>
				<span
					class="block h-2.5 w-2.5 shrink-0 rounded-full"
					style="background: {teamColors[player.team] ?? teamColors.Civilian}"
				></span>
			</Tooltip>

			<span class="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>

			{#if outside.has(player.name)}
				<span
					class="shrink-0 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-medium text-red-300"
				>
					No Discord
				</span>
			{/if}

			{#if player.permission !== 'Normal'}
				<span
					class="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium {permissionTones[
						player.permission
					] ?? 'border-line bg-white/5 text-muted'}"
				>
					{player.permission.replace('Server ', '')}
				</span>
			{/if}

			<button
				type="button"
				onclick={() => (open = player.id)}
				aria-label="Manage {player.name}"
				class="tap shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-white/8 hover:text-white"
			>
				<Settings2 class="h-4 w-4" />
			</button>
		</li>
	{:else}
		<li class="px-5 py-12 text-center text-sm text-muted">
			{query || team ? 'No players match those filters.' : 'Nobody is in the server right now.'}
		</li>
	{/each}
</ul>

{#if viewing && checked}
	<div use:portal class="fixed inset-0 z-60 flex items-center justify-center p-4">
		<button
			type="button"
			aria-label="Close the Discord check"
			onclick={() => (viewing = false)}
			class="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
			transition:fade={{ duration: 140 }}
		></button>

		<div
			class="relative flex max-h-full w-full max-w-175 flex-col rounded-2xl border border-line bg-surface shadow-2xl shadow-black/60"
			transition:scale={{ duration: 160, start: 0.97 }}
		>
			<header class="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
				<div class="min-w-0 flex-1">
					<h2 class="truncate text-base font-semibold">Discord check</h2>
					<p class="mt-0.5 truncate text-xs text-muted">
						{results.length} of {checked.length} shown - {outside.size} not in the Discord server
					</p>
				</div>

				<button
					type="button"
					onclick={() => (viewing = false)}
					aria-label="Close the Discord check"
					class="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-white/8 hover:text-white"
				>
					<X class="h-4 w-4" />
				</button>
			</header>

			<div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-5 py-3">
				<input
					bind:value={checkQuery}
					placeholder="Search usernames or IDs"
					aria-label="Search usernames or IDs"
					autocomplete="off"
					class="min-w-40 flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted focus:border-line focus:ring-0"
				/>

				<div class="shrink-0 sm:w-44">
					<Select
						compact
						options={checkTeams}
						bind:value={checkTeam}
						placeholder="All teams"
						label={checkTeam ? undefined : 'All teams'}
					/>
				</div>

				<div class="shrink-0 sm:w-40">
					<Select
						compact
						options={staffOptions}
						bind:value={staffFilter}
						placeholder="Everyone"
						label={staffFilter ? undefined : 'Everyone'}
					/>
				</div>

				<div class="shrink-0 sm:w-48">
					<Select
						compact
						options={discordOptions}
						bind:value={discordFilter}
						placeholder="Any Discord status"
						label={discordFilter ? undefined : 'Any Discord status'}
					/>
				</div>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto">
				<ul class="divide-y divide-line">
					{#each results as entry (entry.id)}
						<li class="flex items-center gap-3 px-5 py-3">
							<Tooltip text={entry.team}>
								<span
									class="block h-2.5 w-2.5 shrink-0 rounded-full"
									style="background: {teamColors[entry.team] ?? teamColors.Civilian}"
								></span>
							</Tooltip>

							<div class="flex min-w-0 flex-1 items-center gap-2.5">
								{#if entry.avatarUrl}
									<img
										src={entry.avatarUrl}
										alt=""
										loading="lazy"
										onerror={(event) => event.currentTarget.removeAttribute('src')}
										class="h-8 w-8 shrink-0 rounded-lg border border-line bg-white/5 object-cover"
									/>
								{:else}
									<div class="h-8 w-8 shrink-0 rounded-lg border border-line bg-white/5"></div>
								{/if}

								<div class="min-w-0">
									<p class="truncate text-sm font-medium">{entry.name}</p>
									<p class="mt-0.5 truncate text-xs text-muted">{entry.id}</p>
								</div>
							</div>

							<ArrowRight class="hidden h-4 w-4 shrink-0 text-muted sm:block" />

							<div class="hidden min-w-0 flex-1 items-center gap-2.5 sm:flex">
								{#if entry.discordId}
									{#if entry.discordAvatarUrl}
										<img
											src={entry.discordAvatarUrl}
											alt=""
											loading="lazy"
											onerror={(event) => event.currentTarget.removeAttribute('src')}
											class="h-8 w-8 shrink-0 rounded-full border border-line bg-white/5 object-cover"
										/>
									{:else}
										<div class="h-8 w-8 shrink-0 rounded-full border border-line bg-white/5"></div>
									{/if}

									<div class="min-w-0">
										<p class="truncate text-sm">{entry.discordName}</p>
										<p class="mt-0.5 truncate text-xs text-muted">{entry.discordId}</p>
									</div>
								{:else}
									<p class="truncate text-xs text-muted">Not in the Discord server</p>
								{/if}
							</div>

							{#if entry.staff}
								<span
									class="shrink-0 rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-0.5 text-[11px] font-medium text-blue-300"
								>
									Staff
								</span>
							{/if}

							{#if !entry.discordId}
								<span
									class="shrink-0 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-medium text-red-300"
								>
									No Discord
								</span>
							{/if}
						</li>
					{:else}
						<li class="px-5 py-12 text-center text-sm text-muted">
							No players match those filters.
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
{/if}

{#if active}
	<div use:portal class="fixed inset-0 z-60 flex items-center justify-center p-4">
		<button
			type="button"
			aria-label="Close the player panel"
			onclick={() => (open = '')}
			class="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
			transition:fade={{ duration: 140 }}
		></button>

		<div
			class="relative flex max-h-full w-full max-w-125 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/60"
			transition:scale={{ duration: 160, start: 0.97 }}
		>
			<header class="flex shrink-0 items-start gap-4 border-b border-line px-5 py-4">
				{#if profile?.avatarUrl}
					<img
						src={profile.avatarUrl}
						alt=""
						onerror={(event) => event.currentTarget.removeAttribute('src')}
						class="h-14 w-14 shrink-0 rounded-xl border border-line bg-white/5 object-cover"
					/>
				{:else}
					<div class="h-14 w-14 shrink-0 rounded-xl border border-line bg-white/5"></div>
				{/if}

				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<p class="truncate text-base font-semibold">
							{profile?.displayName ?? active.name}
						</p>

						<Tooltip text={active.team}>
							<span
								class="block h-2.5 w-2.5 shrink-0 rounded-full"
								style="background: {teamColors[active.team] ?? teamColors.Civilian}"
							></span>
						</Tooltip>

						{#if profile?.banned}
							<span
								class="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-medium text-red-300"
							>
								<Ban class="h-3 w-3" />
								Terminated
							</span>
						{/if}
					</div>

					<p class="mt-0.5 truncate text-sm text-muted">@{active.name} - {active.id}</p>
				</div>

				<div class="flex shrink-0 items-center gap-1">
					<a
						href="https://www.roblox.com/users/{active.id}/profile"
						rel="noreferrer noopener"
						target="_blank"
						aria-label="Open the Roblox profile"
						class="rounded-lg p-2 text-muted transition-colors hover:bg-white/8 hover:text-white"
					>
						<ExternalLink class="h-4 w-4" />
					</a>

					<button
						type="button"
						onclick={() => (open = '')}
						aria-label="Close the player panel"
						class="rounded-lg p-2 text-muted transition-colors hover:bg-white/8 hover:text-white"
					>
						<X class="h-4 w-4" />
					</button>
				</div>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto">
				<dl class="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
					{#each [{ label: 'Friends', value: profile?.friends }, { label: 'Followers', value: profile?.followers }, { label: 'Priors here', value: priors.length }, { label: 'Rank', value: active.permission.replace('Server ', '') || 'Normal' }] as tile (tile.label)}
						<div class="px-5 py-3">
							<dt class="text-xs text-muted">{tile.label}</dt>
							<dd class="mt-0.5 truncate text-sm font-semibold">
								{#if loading && tile.value === undefined}
									<span class="skeleton block h-4 w-12 rounded bg-white/10"></span>
								{:else}
									{tile.value ?? 'Unknown'}
								{/if}
							</dd>
						</div>
					{/each}
				</dl>

				<div
					class="flex flex-wrap gap-x-6 gap-y-1 border-b border-line px-5 py-3 text-xs text-muted"
				>
					{#if loading}
						<span class="skeleton h-3 w-40 rounded bg-white/10"></span>
					{:else}
						<span>{joined ? `Roblox account made ${joined}` : 'Join date unavailable'}</span>
						<span>On the {active.team} team</span>
					{/if}
				</div>

				<div class="px-5 py-4">
					{#each groups as group (group.label)}
						<p class="mt-3 text-[11px] text-muted first:mt-0">{group.label}</p>
						<div class="mt-1.5 flex flex-wrap gap-1.5">
							{#each group.commands as command (command)}
								<button
									type="button"
									disabled={!!panel.pending}
									onclick={() =>
										panel.act(`${command}:${active.id}`, {
											action: 'player',
											command,
											username: active.name,
											playerId: active.id
										})}
									class="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 {danger.has(
										command
									)
										? 'border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20'
										: 'border-line bg-white/5 hover:bg-white/10'}"
								>
									{labels[command]}
								</button>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}
