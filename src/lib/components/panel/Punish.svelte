<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Ban from '@lucide/svelte/icons/ban';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Gavel from '@lucide/svelte/icons/gavel';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Search from '@lucide/svelte/icons/search';
	import ShieldPlus from '@lucide/svelte/icons/shield-plus';
	import Users from '@lucide/svelte/icons/users';
	import { fly } from 'svelte/transition';
	import Input from '$lib/components/settings/Input.svelte';
	import MultiSelect from '$lib/components/settings/MultiSelect.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { placement } from '$lib/dropdown';
	import { stamp, teamColors, type Panel } from '$lib/panelClient.svelte';
	import { toast } from '$lib/toast.svelte';
	import { indexNames, matchNames, type SeenName } from '$lib/usernames';
	import type { LogEntry, Preset, RobloxProfile, RobloxUser } from '$lib/server/panel';
	import type { PunishRequest } from '$lib/speech';

	let {
		panel,
		punishmentTypes,
		presets,
		prefill = $bindable(null)
	}: {
		panel: Panel;
		punishmentTypes: string[];
		presets: Preset[];
		prefill?: PunishRequest | null;
	} = $props();

	interface Candidate {
		id: string;
		name: string;
		team: string;
		live: boolean;
		at: number;
	}

	let query = $state('');
	let target = $state<RobloxUser | null>(null);
	let results = $state<RobloxUser[]>([]);
	let searching = $state(false);

	let field = $state<HTMLElement>();
	let place = $state({ up: false, max: 320 });
	let highlight = $state(-1);
	let dismissed = $state(false);

	let profile = $state<RobloxProfile | null>(null);
	let loadingProfile = $state(false);

	let type = $state('');
	let reason = $state('');
	let hours = $state(0);

	let picker = $state<HTMLInputElement>();
	let dropping = $state(false);
	let uploading = $state(false);

	const contextLimit = 5;

	$effect(() => {
		if (!type && punishmentTypes.length) type = punishmentTypes[0];
	});

	$effect(() => {
		const fill = prefill;
		if (!fill) return;

		pick(fill.id, fill.username, fill.username);
		if (fill.type) type = fill.type;
		reason = fill.reason;
		prefill = null;
	});

	const typeOptions = $derived(punishmentTypes.map((name) => ({ value: name, label: name })));

	const online = $derived(panel.snapshot.server.players);
	const term = $derived(query.trim().toLowerCase());

	const departed = $derived.by(() => {
		if (!term) return [];

		const skip = new Set(online.map((player) => player.id));
		const rows: Candidate[] = [];

		for (const entry of panel.snapshot.logs) {
			if (entry.kind !== 'joins' || !entry.actorId) continue;
			if (skip.has(entry.actorId)) continue;
			if (!entry.actor.toLowerCase().includes(term)) continue;
			if (rows.some((row) => row.id === entry.actorId)) continue;

			rows.push({
				id: entry.actorId,
				name: entry.actor,
				team: '',
				live: false,
				at: entry.timestamp
			});
		}

		return rows;
	});

	const nearby = $derived.by(() => {
		const live: Candidate[] = online
			.filter((player) => !term || player.name.toLowerCase().includes(term))
			.map((player) => ({
				id: player.id,
				name: player.name,
				team: player.team,
				live: true,
				at: 0
			}));

		const rank = (entry: Candidate) =>
			(entry.live ? 0 : 2) + (term && entry.name.toLowerCase().startsWith(term) ? 0 : 1);

		return [...live, ...departed].sort((a, b) => rank(a) - rank(b) || b.at - a.at).slice(0, 12);
	});

	const found = $derived.by(() => {
		const seen = new Set(nearby.map((entry) => entry.id));
		return results.filter((user) => !seen.has(user.id));
	});

	const known = $derived.by(() => {
		const now = Math.floor(Date.now() / 1000);
		const entries: SeenName[] = online.map((player) => ({
			name: player.name,
			id: player.id,
			at: now
		}));

		for (const entry of panel.snapshot.moderations) {
			entries.push({ name: entry.username, id: entry.userId, at: entry.epoch });
		}

		for (const entry of panel.snapshot.logs) {
			if (entry.kind !== 'joins' || !entry.actorId) continue;
			entries.push({ name: entry.actor, id: entry.actorId, at: entry.timestamp });
		}

		return indexNames(entries);
	});

	const suggestions = $derived.by(() => {
		if (!term || dismissed) return [];

		const shown = new Set(nearby.map((entry) => entry.id));
		return matchNames(
			term,
			known.filter((entry) => !shown.has(entry.id))
		);
	});

	function steer(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			dismissed = true;
			return;
		}

		if (!suggestions.length) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlight = (highlight + 1) % suggestions.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlight = (highlight <= 0 ? suggestions.length : highlight) - 1;
		} else if (event.key === 'Enter' && highlight >= 0) {
			event.preventDefault();
			const entry = suggestions[highlight];
			pick(entry.id, entry.name, entry.name);
		}
	}

	$effect(() => {
		const search = query.trim();
		if (search.length < 3) {
			results = [];
			return;
		}

		let active = true;
		searching = true;

		const timer = setTimeout(() => {
			fetch(`${panel.base}?feed=roblox&query=${encodeURIComponent(search)}`)
				.then((response) => (response.ok ? response.json() : []))
				.then((users: RobloxUser[]) => active && (results = users))
				.catch(() => active && (results = []))
				.finally(() => active && (searching = false));
		}, 350);

		return () => {
			active = false;
			clearTimeout(timer);
		};
	});

	$effect(() => {
		const id = target?.id;
		if (!id) {
			profile = null;
			return;
		}

		let active = true;
		loadingProfile = true;
		profile = null;

		fetch(`${panel.base}?feed=profile&id=${encodeURIComponent(id)}`)
			.then((response) => (response.ok ? response.json() : null))
			.then((value: RobloxProfile | null) => active && (profile = value))
			.catch(() => active && (profile = null))
			.finally(() => active && (loadingProfile = false));

		return () => {
			active = false;
		};
	});

	const presence = $derived.by(() => {
		const picked = target;
		return picked ? online.find((player) => player.id === picked.id) : undefined;
	});

	const history = $derived.by(() => {
		const picked = target;
		if (!picked) return [];

		return panel.snapshot.moderations.filter((entry) => entry.userId === picked.id);
	});

	const context = $derived.by(() => {
		const picked = target;
		if (!picked) return { vehicles: [], firstJoin: null, lastLeave: null, commands: [] };

		const name = picked.username.toLowerCase();
		const mine = (entry: LogEntry) =>
			entry.actorId === picked.id || entry.actor.toLowerCase() === name;

		const joins = panel.snapshot.logs.filter((entry) => entry.kind === 'joins' && mine(entry));

		return {
			vehicles: panel.snapshot.server.vehicles.filter(
				(vehicle) => vehicle.owner.toLowerCase() === name
			),
			firstJoin: joins.findLast((entry) => entry.detail === 'joined') ?? null,
			lastLeave: joins.find((entry) => entry.detail === 'left') ?? null,
			commands: panel.snapshot.logs
				.filter(
					(entry) =>
						entry.kind === 'commands' && (mine(entry) || entry.detail.toLowerCase().includes(name))
				)
				.slice(0, contextLimit)
		};
	});

	const usable = $derived(presets.filter((preset) => preset.permissionLevel <= panel.level));
	const presetOptions = $derived(
		usable.map((preset) => ({ value: preset.name, label: preset.name }))
	);
	let chosen = $state<string[]>([]);

	function pick(id: string, username: string, displayName: string) {
		target = { id, username, displayName };
		panel.focus = { id, username };
		query = '';
		results = [];
		highlight = -1;
		dismissed = false;
	}

	function unpick() {
		target = null;
		panel.focus = null;
	}

	function insert() {
		const picked = usable.filter((preset) => chosen.includes(preset.name));
		if (!picked.length) return;

		const merged = picked.map((preset) => preset.result).join(', ');
		reason = reason.trim() ? `${reason.trim()}, ${merged}` : merged;

		const counts: Record<string, number> = {};
		for (const preset of picked) {
			if (preset.type) counts[preset.type] = (counts[preset.type] ?? 0) + 1;
		}

		const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
		if (common && punishmentTypes.includes(common)) type = common;

		chosen = [];
	}

	async function upload(file: File | null | undefined) {
		if (!file || uploading) return;

		const body = new FormData();
		body.append('file', file);

		uploading = true;

		try {
			const response = await fetch(`/api/upload/${panel.guildId}`, { method: 'POST', body });
			const payload = (await response.json().catch(() => null)) as {
				url?: string;
				message?: string;
			} | null;

			if (!response.ok || !payload?.url) {
				toast(payload?.message || 'That upload did not go through, try again shortly.', 'error');
				return;
			}

			const name = file.name.replace(/\.[^.]+$/, '');
			const proof = `[Proof - ${name}](${payload.url})`;

			reason = reason.trim() ? `${reason.trim()}\n${proof}` : proof;
			toast('Proof attached to the reason.', 'success');
		} catch {
			toast('That upload did not go through, try again shortly.', 'error');
		} finally {
			uploading = false;
		}
	}

	function clear() {
		chosen = [];
		reason = '';
	}

	async function submit() {
		if (!target) return;

		const untilEpoch = hours > 0 ? String(Math.floor(Date.now() / 1000) + hours * 3600) : '';

		const done = await panel.act('punish', {
			action: 'moderation.create',
			userId: target.id,
			username: target.username,
			type,
			reason,
			untilEpoch
		});

		if (!done) return;

		clear();
		hours = 0;
		unpick();
	}
</script>

{#if !target}
	<div class="border-b border-line px-5 py-4">
		<div class="relative" bind:this={field}>
			<div class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3">
				<Search class="h-4 w-4 shrink-0 text-muted" />
				<input
					bind:value={query}
					oninput={() => {
						highlight = -1;
						dismissed = false;
						place = placement(field);
					}}
					onkeydown={steer}
					placeholder="Search a player by username"
					aria-label="Search a player"
					autocomplete="off"
					role="combobox"
					aria-expanded={suggestions.length > 0}
					aria-controls="punish-suggestions"
					aria-activedescendant={highlight >= 0 ? `punish-suggestion-${highlight}` : undefined}
					class="w-full border-0 bg-transparent px-0 py-2.5 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
				/>
			</div>

			{#if suggestions.length}
				<ul
					id="punish-suggestions"
					role="listbox"
					aria-label="Players seen before"
					class="absolute {place.up
						? 'bottom-full mb-2'
						: 'top-full mt-2'} right-0 left-0 z-60 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-2xl shadow-black/60"
					style="max-height: {place.max}px"
					transition:fly={{ y: -6, duration: 150 }}
				>
					{#each suggestions as entry, index (entry.id + entry.name)}
						<li>
							<button
								type="button"
								id="punish-suggestion-{index}"
								role="option"
								aria-selected={index === highlight}
								onclick={() => pick(entry.id, entry.name, entry.name)}
								onmouseenter={() => (highlight = index)}
								class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors {index ===
								highlight
									? 'bg-white/8 text-white'
									: 'text-muted hover:bg-white/5'}"
							>
								<span class="min-w-0 flex-1 truncate">{entry.name}</span>
								<span class="shrink-0 text-xs text-muted">{stamp(entry.at)}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	{#if nearby.length}
		<p class="px-5 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
			This server
		</p>

		<ul class="divide-y divide-line">
			{#each nearby as player (player.id)}
				<li>
					<button
						type="button"
						onclick={() => pick(player.id, player.name, player.name)}
						class="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-white/5"
					>
						<span
							class="h-2 w-2 shrink-0 rounded-full"
							style="background: {player.live
								? (teamColors[player.team] ?? teamColors.Civilian)
								: '#8b8b8b'}"
						></span>
						<span class="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>

						{#if player.live}
							<span
								class="shrink-0 rounded-full border border-green-400/30 bg-green-400/10 px-2 py-0.5 text-[11px] font-medium text-green-300"
							>
								In game
							</span>
							<span class="shrink-0 text-xs text-muted">{player.team}</span>
						{:else}
							<span
								class="shrink-0 rounded-full border border-line bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted"
							>
								Recently in game
							</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if query.trim().length >= 3}
		<p class="px-5 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
			Roblox
		</p>

		{#if searching && !found.length}
			<div class="flex flex-col gap-3 px-5 py-3">
				{#each [0, 1, 2] as row (row)}
					<div class="skeleton">
						<div class="h-3.5 w-32 rounded bg-white/10"></div>
					</div>
				{/each}
			</div>
		{:else}
			<ul class="divide-y divide-line">
				{#each found as user (user.id)}
					<li>
						<button
							type="button"
							onclick={() => pick(user.id, user.username, user.displayName)}
							class="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-white/5"
						>
							<span class="min-w-0 flex-1 truncate text-sm font-medium">{user.username}</span>
							<span class="shrink-0 truncate text-xs text-muted">{user.displayName}</span>
						</button>
					</li>
				{:else}
					<li class="px-5 py-6 text-center text-sm text-muted">No Roblox users found.</li>
				{/each}
			</ul>
		{/if}
	{:else if !nearby.length}
		<div class="px-5 py-12 text-center">
			<Users class="mx-auto h-6 w-6 text-muted" />
			<p class="mt-3 text-sm font-medium">Pick someone to punish</p>
			<p class="mt-1 text-sm text-muted">
				Search a Roblox username, or choose a player from the server.
			</p>
		</div>
	{/if}
{:else}
	<div class="flex flex-wrap items-start gap-4 border-b border-line px-5 py-4">
		{#if profile?.avatarUrl}
			<img
				src={profile.avatarUrl}
				alt=""
				class="h-16 w-16 shrink-0 rounded-xl border border-line bg-white/5 object-cover"
			/>
		{:else}
			<div class="h-16 w-16 shrink-0 rounded-xl border border-line bg-white/5"></div>
		{/if}

		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-2">
				<p class="truncate text-base font-semibold">
					{profile?.displayName ?? target.username}
				</p>

				{#if profile?.banned}
					<span
						class="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-medium text-red-300"
					>
						<Ban class="h-3 w-3" />
						Terminated
					</span>
				{/if}

				{#if presence}
					<Tooltip text="In game on {presence.team}">
						<span
							class="block h-2.5 w-2.5 shrink-0 rounded-full"
							style="background: {teamColors[presence.team] ?? teamColors.Civilian}"
						></span>
					</Tooltip>
				{/if}
			</div>

			<p class="mt-0.5 truncate text-sm text-muted">@{target.username} - {target.id}</p>

			<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
				{#if loadingProfile}
					<span class="skeleton h-3 w-40 rounded bg-white/10"></span>
				{:else if profile}
					{#if profile.created}
						<span>Joined {stamp(Math.floor(new Date(profile.created).getTime() / 1000))}</span>
					{/if}
					<span>{profile.friends} friends</span>
					<span>{profile.followers} followers</span>
				{/if}

				<span>{history.length} prior on this server</span>
			</div>
		</div>

		<div class="flex shrink-0 items-center gap-2">
			<a
				href="https://www.roblox.com/users/{target.id}/profile"
				rel="noreferrer noopener"
				target="_blank"
				aria-label="Open the Roblox profile"
				class="rounded-lg border border-line bg-white/5 p-2 text-muted transition-colors hover:bg-white/10 hover:text-white"
			>
				<ExternalLink class="h-4 w-4" />
			</a>

			<button
				type="button"
				onclick={unpick}
				class="inline-flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3.5 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/10 hover:text-white"
			>
				<ArrowLeft class="h-4 w-4" />
				Pick someone else
			</button>
		</div>
	</div>

	{#if context.vehicles.length || context.firstJoin || context.lastLeave || context.commands.length}
		<div class="grid gap-4 border-b border-line px-5 py-4 sm:grid-cols-3">
			<div class="min-w-0">
				<p class="text-[11px] font-semibold tracking-wide text-muted uppercase">Vehicles</p>

				{#each context.vehicles as vehicle (vehicle.name + vehicle.texture)}
					<p class="mt-1 truncate text-xs">
						{vehicle.name}
						<span class="text-muted">{vehicle.texture}</span>
					</p>
				{:else}
					<p class="mt-1 text-xs text-muted">None spawned.</p>
				{/each}
			</div>

			<div class="min-w-0">
				<p class="text-[11px] font-semibold tracking-wide text-muted uppercase">Join logs</p>

				{#if context.firstJoin}
					<p class="mt-1 truncate text-xs">
						First joined
						<span class="text-muted">{stamp(context.firstJoin.timestamp)}</span>
					</p>
				{/if}

				{#if context.lastLeave}
					<p class="mt-1 truncate text-xs">
						Left most recently
						<span class="text-muted">{stamp(context.lastLeave.timestamp)}</span>
					</p>
				{/if}

				{#if !context.firstJoin && !context.lastLeave}
					<p class="mt-1 text-xs text-muted">No recent joins.</p>
				{/if}
			</div>

			<div class="min-w-0">
				<p class="text-[11px] font-semibold tracking-wide text-muted uppercase">Command logs</p>

				{#each context.commands as entry (entry.id)}
					<p class="mt-1 truncate text-xs">
						{entry.detail}
						<span class="text-muted">{stamp(entry.timestamp)}</span>
					</p>
				{:else}
					<p class="mt-1 text-xs text-muted">No recent commands.</p>
				{/each}
			</div>
		</div>
	{/if}

	<div
		role="presentation"
		ondragover={(event) => {
			event.preventDefault();
			dropping = true;
		}}
		ondragleave={() => (dropping = false)}
		ondrop={(event) => {
			event.preventDefault();
			dropping = false;
			void upload(event.dataTransfer?.files[0]);
		}}
		class="flex flex-col gap-3 px-5 py-4 {dropping ? 'bg-white/5' : ''}"
	>
		<div class="flex flex-wrap items-center gap-3">
			<div class="min-w-40 flex-1">
				<Select options={typeOptions} bind:value={type} placeholder="Punishment type" />
			</div>

			<div class="w-44 shrink-0">
				<Input type="number" min={0} max={8760} suffix="hours" bind:value={hours} />
			</div>
		</div>

		{#if usable.length}
			<div class="flex flex-wrap items-center gap-3">
				<div class="min-w-40 flex-1">
					<MultiSelect options={presetOptions} bind:values={chosen} placeholder="Apply presets" />
				</div>

				<button
					type="button"
					disabled={!chosen.length}
					onclick={insert}
					class="shrink-0 rounded-lg border border-line bg-white/5 px-3.5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
				>
					Add to reason
				</button>
			</div>
		{/if}

		<textarea
			bind:value={reason}
			rows="4"
			placeholder="Reason, with [Proof - name](url) for evidence"
			aria-label="Punishment reason"
			class="w-full resize-none rounded-lg border border-line bg-white/5 px-3 py-2.5 text-sm placeholder:text-muted focus:border-line focus:ring-0"
		></textarea>

		<div class="flex flex-wrap items-center gap-3">
			<input
				bind:this={picker}
				type="file"
				accept="image/*,video/*"
				aria-label="Choose proof to upload"
				class="hidden"
				onchange={(event) => {
					const input = event.currentTarget;
					void upload(input.files?.[0]);
					input.value = '';
				}}
			/>

			<button
				type="button"
				disabled={uploading}
				onclick={() => picker?.click()}
				class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-white/5 px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
			>
				<Paperclip class="h-4 w-4" />
				{uploading ? 'Uploading proof...' : 'Attach proof'}
			</button>

			<p class="min-w-0 flex-1 text-xs text-muted">
				Drop an image or video anywhere on this form to attach it as proof.
			</p>
		</div>

		<div class="flex flex-wrap gap-2">
			{#if presence}
				<button
					type="button"
					disabled={!!panel.pending}
					onclick={() =>
						panel.act('kick', {
							action: 'player',
							command: 'kick',
							username: presence.name,
							playerId: presence.id
						})}
					class="inline-flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3.5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
				>
					<Gavel class="h-4 w-4" />
					Kick from game
				</button>
			{/if}

			<button
				type="button"
				disabled={!reason.trim() || !!panel.pending}
				onclick={submit}
				class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 pointer-coarse:py-3"
			>
				<ShieldPlus class="h-4 w-4" />
				Log {type} against {target.username}
			</button>
		</div>
	</div>
{/if}
