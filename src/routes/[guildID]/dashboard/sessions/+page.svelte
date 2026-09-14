<script lang="ts">
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Play from '@lucide/svelte/icons/play';
	import Square from '@lucide/svelte/icons/square';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Vote from '@lucide/svelte/icons/vote';
	import { untrack } from 'svelte';
	import MapPinned from '@lucide/svelte/icons/map-pinned';
	import Plus from '@lucide/svelte/icons/plus';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AopEditor from '$lib/components/aop/AopEditor.svelte';
	import AnalyticsChart from '$lib/components/AnalyticsChart.svelte';
	import MessageEditor from '$lib/components/discord/MessageEditor.svelte';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import Channels from '$lib/components/settings/Channels.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Duration from '$lib/components/settings/Duration.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { aopActions, blankRegion, describeEnforcement, maxRegions } from '$lib/aop';
	import { isEmptyMessage, type DiscordMessage } from '$lib/discord';
	import {
		sessionLimits,
		sessionMessages,
		sessionVariables,
		voteButtonRoles,
		voteMessages,
		type ActiveSession,
		type SessionHistoryEntry,
		type SessionMessage
	} from '$lib/sessions';
	import { duration, exactTime, relativeTime } from '$lib/staff';
	import { editable } from '$lib/settingsForm.svelte';
	import { toast } from '$lib/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	let active = $state<ActiveSession | null>(untrack(() => data.active));
	let history = $state<SessionHistoryEntry[]>(untrack(() => data.history));
	let requiredVotes = $state(untrack(() => data.settings.required_votes_default));
	let running = $state('');
	let deleting = $state('');
	let confirming = $state<SessionHistoryEntry | null>(null);
	let editing = $state<SessionMessage | null>(null);
	let editorOpen = $state(false);

	const tabs = $derived([
		{ id: 'overview', label: 'Overview' },
		{ id: 'history', label: 'History' },
		...(data.management
			? [
					{ id: 'area-of-play', label: 'Area of Play' },
					{ id: 'settings', label: 'Settings' }
				]
			: [])
	]);

	let tab = $state('overview');

	const aop = editable(() => data.aop);

	let drawing = $state('');

	const regionOptions = $derived(
		aop.value.regions.map((region) => ({ value: region.id, label: region.name }))
	);

	const chosen = $derived(aop.value.regions.find((region) => region.id === drawing) ?? null);

	const actionOptions = aopActions.map((entry) => ({
		value: entry,
		label:
			entry === 'wanted' ? 'Mark them wanted' : `${entry[0].toUpperCase()}${entry.slice(1)} them`
	}));

	function addRegion() {
		const region = blankRegion(`Area ${aop.value.regions.length + 1}`);

		aop.value.regions = [...aop.value.regions, region];
		drawing = region.id;
		if (!aop.value.default_region) aop.value.default_region = region.id;
	}

	function removeRegion(id: string) {
		aop.value.regions = aop.value.regions.filter((region) => region.id !== id);
		if (drawing === id) drawing = '';
		if (aop.value.default_region === id) aop.value.default_region = '';
	}

	const progress = $derived(
		active && active.requiredVotes > 0
			? Math.min(100, Math.round((active.votes / active.requiredVotes) * 100))
			: 0
	);

	const peak = $derived(active ? Math.max(active.maxPlayers, ...active.playerCounts, 0) : 0);

	const attendance = $derived.by(() => {
		if (!active) return '';
		if (active.playersInGame < 0) return 'Live player data is unavailable right now.';

		const unlinked = active.votedUsers.length - active.votersLinked;
		if (unlinked > 0) {
			return `${unlinked} of them ${unlinked === 1 ? 'has' : 'have'} no Roblox account linked.`;
		}

		const missing = active.votedUsers.length - active.votersInGame;
		return missing ? `${missing} still to join.` : 'Everyone who voted is in game.';
	});

	const summary = $derived.by(() => {
		const lengths = history.map((entry) => entry.endedAt - entry.startedAt).filter((s) => s > 0);
		const total = lengths.reduce((sum, value) => sum + value, 0);

		return {
			sessions: history.length,
			average: lengths.length ? Math.round(total / lengths.length) : 0,
			total,
			busiest: Math.max(0, ...history.map((entry) => entry.maxPlayers))
		};
	});

	function open(id: SessionMessage) {
		editing = id;
		editorOpen = true;
	}

	function configured(message: DiscordMessage): boolean {
		return !isEmptyMessage(message);
	}

	function control(action: string, done: string) {
		running = action;

		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			running = '';

			if (result.type === 'failure') {
				toast(String(result.data?.message ?? 'That did not work.'), 'error');
				return;
			}

			active = (result.data?.active ?? null) as ActiveSession | null;
			if (result.data?.history) history = result.data.history as SessionHistoryEntry[];

			toast(done, 'success');
		};
	}

	$effect(() => {
		const timer = setInterval(async () => {
			if (document.hidden || running !== '') return;

			try {
				const reply = await fetch(`/api/sessions/${data.guild.id}`);
				if (reply.ok) active = ((await reply.json()) as { active: ActiveSession | null }).active;
			} catch {
				return;
			}
		}, 15000);

		return () => clearInterval(timer);
	});

	function sparkline(counts: number[]): string {
		if (counts.length < 2) return '';

		const highest = Math.max(...counts, 1);
		const step = 100 / (counts.length - 1);

		return counts.map((count, index) => `${index * step},${30 - (count / highest) * 28}`).join(' ');
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (confirming && event.key === 'Escape') confirming = null;
	}}
/>

<PageHeader
	description="Run session votes and startup messages for your ER:LC server, straight from here."
/>

<div
	class="no-scrollbar mt-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-bg/40 p-1"
>
	{#each tabs as entry (entry.id)}
		<button
			type="button"
			onclick={() => (tab = entry.id)}
			aria-current={tab === entry.id ? 'page' : undefined}
			class="shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors pointer-coarse:py-3 {tab ===
			entry.id
				? 'bg-white/8 font-medium text-white'
				: 'text-muted hover:bg-white/5 hover:text-white'}"
		>
			{entry.label}
		</button>
	{/each}
</div>

{#snippet tile(label: string, value: string)}
	<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
		<p class="text-xs tracking-wide text-muted uppercase">{label}</p>
		<p class="mt-1 text-2xl font-semibold">{value}</p>
	</div>
{/snippet}

<div class="mt-6 flex flex-col gap-6">
	{#if tab === 'overview'}
		<Card title="Live session" description="What your server is doing right now.">
			{#if !active}
				<Row
					label="No session running"
					description="Start one now, or post a vote to let members ask for one."
					tight
				>
					<div class="flex flex-wrap items-center gap-3">
						<form
							method="POST"
							action="?/vote"
							use:enhance={() => control('vote', 'Session vote posted.')}
							class="flex flex-wrap items-center gap-3"
						>
							<input type="hidden" name="required_votes" value={requiredVotes} />
							<label class="flex items-center gap-2 text-sm whitespace-nowrap text-muted">
								Votes needed
								<span class="w-20">
									<Input
										type="number"
										min={1}
										max={sessionLimits.requiredVotes}
										bind:value={requiredVotes}
									/>
								</span>
							</label>
							<button
								type="submit"
								disabled={running !== ''}
								class="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
							>
								<Vote class="h-4 w-4" />
								{running === 'vote' ? 'Posting...' : 'Post vote'}
							</button>
						</form>

						<form
							method="POST"
							action="?/start"
							use:enhance={() => control('start', 'Session started.')}
						>
							<button
								type="submit"
								disabled={running !== ''}
								class="flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
							>
								<Play class="h-4 w-4" />
								{running === 'start' ? 'Starting...' : 'Start session'}
							</button>
						</form>
					</div>
				</Row>
			{:else}
				<div class="px-6 py-5">
					<div class="flex flex-wrap items-center justify-between gap-4">
						<div class="min-w-0">
							<p class="font-medium">
								{active.started ? 'Session running' : 'Vote in progress'}
							</p>
						</div>

						<div class="flex items-center gap-2">
							{#if !active.started}
								<form
									method="POST"
									action="?/start"
									use:enhance={() => control('start', 'Session started.')}
								>
									<button
										type="submit"
										disabled={running !== ''}
										class="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
									>
										<Play class="h-4 w-4" />
										{running === 'start' ? 'Starting...' : 'Start now'}
									</button>
								</form>
							{/if}

							<form
								method="POST"
								action="?/end"
								use:enhance={() => control('end', 'Session ended.')}
							>
								<button
									type="submit"
									disabled={running !== ''}
									class="flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
								>
									<Square class="h-4 w-4" />
									{running === 'end' ? 'Ending...' : 'End session'}
								</button>
							</form>
						</div>
					</div>

					{#if !active.started}
						<div class="mt-5 rounded-lg border border-line bg-white/2 px-4 py-3">
							<p class="text-xs tracking-wide text-muted uppercase">Votes</p>
							<p class="mt-1 text-2xl font-semibold">
								{active.votes}<span class="text-base text-muted">/{active.requiredVotes}</span>
							</p>
							<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
								<div class="h-full rounded-full bg-red-500" style="width: {progress}%"></div>
							</div>
						</div>
					{:else}
						<div
							class="mt-5 grid gap-4 {active.votedUsers.length
								? 'sm:grid-cols-3'
								: 'sm:grid-cols-2'}"
						>
							{#if active.votedUsers.length}
								<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
									<p class="text-xs tracking-wide text-muted uppercase">Voters in game</p>
									<p class="mt-1 text-2xl font-semibold">
										{active.playersInGame < 0 ? '-' : active.votersInGame}<span
											class="text-base text-muted">/{active.votedUsers.length}</span
										>
									</p>
									<p class="mt-1 text-xs text-muted">{attendance}</p>
								</div>
							{/if}

							{@render tile(
								'Players in game',
								active.playersInGame < 0 ? '-' : String(active.playersInGame)
							)}

							<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
								<p class="text-xs tracking-wide text-muted uppercase">Peak players</p>
								<p class="mt-1 text-2xl font-semibold">{peak}</p>
								{#if sparkline(active.playerCounts)}
									<svg viewBox="0 0 100 30" preserveAspectRatio="none" class="mt-2 h-6 w-full">
										<polyline
											points={sparkline(active.playerCounts)}
											fill="none"
											stroke="currentColor"
											stroke-width="1.5"
											stroke-linecap="round"
											stroke-linejoin="round"
											vector-effect="non-scaling-stroke"
											class="text-red-500"
										/>
									</svg>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</Card>

		<Card
			title="Analytics"
			description="Across {summary.sessions} session{summary.sessions === 1 ? '' : 's'} on record."
		>
			<div class="grid gap-4 px-6 py-5 sm:grid-cols-4">
				{@render tile('Sessions', String(summary.sessions))}
				{@render tile('Average length', summary.average ? duration(summary.average) : '-')}
				{@render tile('Time hosted', summary.total ? duration(summary.total) : '-')}
				{@render tile(
					'Busiest session',
					summary.busiest ? `${summary.busiest} player${summary.busiest === 1 ? '' : 's'}` : '-'
				)}
			</div>

			{#if !summary.sessions}
				<Callout>History is recorded from the next session you end, so this starts empty.</Callout>
			{/if}
		</Card>

		<Card title="Server activity" description="Players in game, sampled by the analytics service.">
			{#await data.analytics}
				<div class="px-6 py-5">
					<div class="skeleton h-52 rounded-lg bg-white/8"></div>
				</div>
			{:then points}
				<div class="settled">
					<AnalyticsChart {points} />
				</div>
			{/await}
		</Card>
	{:else if tab === 'history'}
		<Card title="Past sessions" description="The most recent 50 sessions your server has run.">
			{#if !history.length}
				<p class="px-6 py-8 text-center text-sm text-muted">
					No sessions recorded yet. The next session you end will show up here.
				</p>
			{:else}
				<div class="divide-y divide-line">
					{#each history as entry (entry.id)}
						<div class="px-6 py-4">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<p class="font-medium">{exactTime(entry.startedAt)}</p>
								<div class="flex items-center gap-3">
									<p class="text-sm text-muted">
										{duration(entry.endedAt - entry.startedAt)} · ended {relativeTime(
											entry.endedAt
										)}
									</p>
									<a
										href={resolve('/[guildID]/dashboard/sessions/[sessionID]', {
											guildID: data.guild.id,
											sessionID: entry.id
										})}
										aria-label="Open the overview for this session"
										class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
									>
										<ChartLine class="h-4 w-4" />
									</a>

									{#if data.management}
										<button
											type="button"
											onclick={() => (confirming = entry)}
											disabled={deleting === entry.id}
											aria-label="Delete this session's data"
											class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
										>
											<Trash2 class="h-4 w-4" />
										</button>
									{/if}
								</div>
							</div>

							<div class="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
								<span class="text-muted">
									Peak players <span class="font-medium text-white">{entry.maxPlayers}</span>
								</span>
								<span class="text-muted">
									Votes <span class="font-medium text-white">{entry.votes}</span>
								</span>
								<span class="text-muted">
									Commands <span class="font-medium text-white">{entry.commands}</span>
								</span>
								<span class="text-muted">
									Kills <span class="font-medium text-white">{entry.kills}</span>
								</span>
								<span class="text-muted">
									Joins <span class="font-medium text-white">{entry.joins}</span>
								</span>
							</div>

							{#if sparkline(entry.playerCounts)}
								<svg viewBox="0 0 100 30" preserveAspectRatio="none" class="mt-3 h-8 w-full">
									<polyline
										points={sparkline(entry.playerCounts)}
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										vector-effect="non-scaling-stroke"
										class="text-red-500"
									/>
								</svg>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</Card>
	{:else if tab === 'area-of-play'}
		<Card title="Enforcement" description="What happens to someone outside the area.">
			{#snippet action()}
				<Switch bind:checked={aop.value.enabled} label="Area of Play" />
			{/snippet}

			<div
				class="divide-y divide-line transition-opacity {aop.value.enabled
					? ''
					: 'pointer-events-none opacity-50'}"
				inert={!aop.value.enabled}
			>
				<Row
					label="Only During Sessions"
					description="Leave this on so nobody is chased off a server that is not running a session."
					tight
				>
					<Switch bind:checked={aop.value.sessions_only} label="Only during sessions" />
				</Row>

				<Row label="Default Area" description="Enforced unless a session picks a different one.">
					<Select
						options={regionOptions}
						bind:value={aop.value.default_region}
						placeholder="No area yet"
						disabled={!regionOptions.length}
					/>
				</Row>

				<Row
					label="Grace Period"
					description="How long someone may be outside before the first warning."
				>
					<Input
						type="number"
						min={0}
						max={59}
						suffix="minutes"
						bind:value={
							() => Math.round(aop.value.grace_seconds / 60),
							(minutes) =>
								(aop.value.grace_seconds =
									Math.min(59, Math.max(0, Math.round(Number(minutes) || 0))) * 60)
						}
					/>
				</Row>

				<Row
					label="Warnings"
					description="In game messages before anything happens. Zero acts immediately."
				>
					<Input type="number" min={0} max={10} bind:value={aop.value.warnings} />
				</Row>

				<Row label="Then" description="What happens once the warnings run out.">
					<Select options={actionOptions} bind:value={aop.value.action} />
				</Row>

				<Row label="Warning Message" description="Sent in game as a private message." wide>
					<Input
						bind:value={aop.value.warning_message}
						maxlength={200}
						placeholder="You are outside the area of play."
					/>
				</Row>

				<div class="px-6 py-4">
					<p class="text-sm text-muted">{describeEnforcement(aop.value)}</p>
				</div>
			</div>
		</Card>

		<Card title="Areas" description="Click the map to drop points. Three or more closes the shape.">
			{#snippet action()}
				<button
					type="button"
					onclick={addRegion}
					disabled={aop.value.regions.length >= maxRegions}
					class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:py-3"
				>
					<Plus class="h-4 w-4" aria-hidden="true" />
					Add area
				</button>
			{/snippet}

			{#if aop.value.regions.length >= maxRegions}
				<p class="px-6 pt-4 text-sm text-muted">You have reached the {maxRegions} area limit.</p>
			{/if}

			{#if !aop.value.regions.length}
				<div class="px-6 py-10 text-center">
					<div
						class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
					>
						<MapPinned class="h-5 w-5 text-muted" aria-hidden="true" />
					</div>
					<p class="mt-4 font-medium">No areas yet</p>
					<p class="mx-auto mt-1 max-w-96 text-sm text-muted">
						Add an area, draw it on the map, then set it as the default above. Nothing is enforced
						until an area has at least three points.
					</p>
				</div>
			{:else}
				<ul class="divide-y divide-line">
					{#each aop.value.regions as region (region.id)}
						<li class="flex flex-wrap items-start gap-4 px-6 py-4">
							<div class="min-w-40 flex-1">
								<Input bind:value={region.name} maxlength={40} label="Area name" />
								<p class="mt-1 text-sm text-muted">
									{region.points.length} point{region.points.length === 1 ? '' : 's'}
									{#if region.points.length < 3}
										&middot; not enough to enforce
									{/if}
									{#if aop.value.default_region === region.id}
										&middot; default
									{/if}
								</p>
							</div>

							<div class="flex min-h-10 shrink-0 gap-2">
								<button
									type="button"
									onclick={() => (drawing = drawing === region.id ? '' : region.id)}
									class="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 pointer-coarse:py-3"
								>
									{drawing === region.id ? 'Close map' : 'Draw'}
								</button>

								<button
									type="button"
									onclick={() => removeRegion(region.id)}
									aria-label="Remove {region.name}"
									class="rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 pointer-coarse:px-3.5 pointer-coarse:py-3.5"
								>
									<Trash2 class="h-4 w-4" aria-hidden="true" />
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>

		{#if chosen}
			<Modal title="Editing {chosen.name}" width="max-w-none" tall onclose={() => (drawing = '')}>
				<AopEditor region={chosen} />
			</Modal>
		{/if}
	{:else}
		<Card title="Setup" description="Where sessions are posted and how voting behaves.">
			<div class="divide-y divide-line">
				<Row label="Channel" description="Vote, start and end messages all go here.">
					<ChannelSelect bind:value={form.value.channel_id} />
				</Row>

				<Row
					label="Dynamic Button"
					description="Show the live vote count on the button instead of a fixed label."
					tight
				>
					<Switch bind:checked={form.value.dynamic_button} label="Dynamic button" />
				</Row>

				{#if !form.value.dynamic_button}
					<Row label="Vote Button Label" description="What the vote button says.">
						<Input
							bind:value={form.value.vote_button_label}
							maxlength={sessionLimits.voteButtonLabel}
							placeholder="Vote"
						/>
					</Row>
				{/if}

				<Row
					label="Default Required Votes"
					description="Used when nobody passes a number to /session vote."
				>
					<Input
						type="number"
						min={1}
						max={sessionLimits.requiredVotes}
						bind:value={form.value.required_votes_default}
					/>
				</Row>
			</div>
		</Card>

		<Card title="Notifications" description="Who gets pinged when a session moves.">
			<div class="divide-y divide-line">
				<Row label="Poll Mention Roles" description="Pinged when a session poll opens.">
					<Roles bind:selected={form.value.poll_mention_roles} placeholder="No roles" />
				</Row>

				<Row label="Startup Mention Roles" description="Pinged when a session starts.">
					<Roles bind:selected={form.value.start_mention_roles} placeholder="No roles" />
				</Row>

				<Row
					label="End Staff Shifts"
					description="End every active shift when a session ends."
					tight
				>
					<Switch bind:checked={form.value.end_staff_shifts} label="End staff shifts" />
				</Row>
			</div>
		</Card>

		<Card title="Automation" description="What ERM does on its own while a session runs.">
			<div class="divide-y divide-line">
				<Row
					label="Announce When Full"
					description="Post the Server Full message the first time every slot is taken."
					tight
				>
					<Switch bind:checked={form.value.auto_full} label="Announce when full" />
				</Row>

				<Row
					label="Boost Below"
					description="Post the Session Boost message once the server drops to this many players. Zero turns it off."
				>
					<Input type="number" min={0} max={50} bind:value={form.value.boost_threshold} />
				</Row>

				{#if form.value.boost_threshold > 0}
					<Row label="Boost Mention Roles" description="Pinged with the boost message.">
						<Roles bind:selected={form.value.boost_mention_roles} placeholder="No roles" />
					</Row>
				{/if}
			</div>
		</Card>

		<Card title="While a session runs" description="Extra rules ERM applies between start and end.">
			<div class="divide-y divide-line">
				<Row
					label="Kick When Closed"
					description="Kick players who join while no session is running."
					tight
				>
					<Switch bind:checked={form.value.auto_kick} label="Kick when closed" />
				</Row>

				{#if form.value.auto_kick}
					<Row label="Grace Period" description="How long a player has to leave before the kick.">
						<Duration bind:seconds={form.value.auto_kick_grace} units={['seconds', 'minutes']} />
					</Row>
				{/if}

				<Row
					label="Lock Channels"
					description="Close these channels when a session starts, and reopen them when it ends."
					tight
				>
					<Switch bind:checked={form.value.channel_locks.enabled} label="Lock channels" />
				</Row>

				{#if form.value.channel_locks.enabled}
					<Row label="Locked Channels" description="Nobody can post in these while a session runs.">
						<Channels bind:selected={form.value.channel_locks.channels} placeholder="No channels" />
					</Row>

					<Row
						label="Locked For"
						description="The role that loses permission. Defaults to everyone."
					>
						<Roles
							selected={form.value.channel_locks.role ? [form.value.channel_locks.role] : []}
							onchange={(next) => (form.value.channel_locks.role = next[0] ?? '')}
							placeholder="Everyone"
							single
						/>
					</Row>
				{/if}
			</div>
		</Card>

		<Card title="Messages" description="What the bot posts at each stage of a session.">
			<div class="divide-y divide-line">
				{#each sessionMessages as entry (entry.id)}
					<Row label="{entry.label} Message" description={entry.description} tight>
						<div class="flex items-center gap-3">
							{#if !configured(form.value[entry.id])}
								<Tooltip text="No message set, nothing will be posted.">
									<TriangleAlert class="h-4 w-4 text-yellow-400" />
								</Tooltip>
							{/if}
							<button
								type="button"
								onclick={() => open(entry.id)}
								class="flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
							>
								<Pencil class="h-4 w-4" />
								Edit
							</button>
						</div>
					</Row>
				{/each}
			</div>

			<Callout>
				The vote and staff vote messages each need a button set to <span class="text-white"
					>Count a vote</span
				>. Add one in the Buttons tab of that message.
			</Callout>
		</Card>
	{/if}
</div>

{#if data.management && tab === 'area-of-play'}
	<SaveBar form={aop} action="?/aop" />
{:else if data.management}
	<SaveBar {form} />
{/if}

{#if editing}
	{@const entry = sessionMessages.find((item) => item.id === editing)}
	<MessageEditor
		bind:open={editorOpen}
		message={form.value[editing]}
		title="{entry?.label} message"
		variables={sessionVariables[editing]}
		buttonRoles={voteMessages.includes(editing) ? voteButtonRoles : []}
	/>
{/if}

{#if confirming}
	{@const target = confirming}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-90 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-session-title"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 id="delete-session-title" class="text-lg font-semibold">Delete this session?</h2>
		<p class="mt-2 text-sm text-muted">
			The session from {exactTime(target.startedAt)} and everything recorded with it will be gone for
			good. This cannot be undone.
		</p>

		<div class="mt-6 flex gap-2">
			<button
				type="button"
				onclick={() => (confirming = null)}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Cancel
			</button>

			<form
				method="POST"
				action="?/deleteSession"
				class="flex-1"
				use:enhance={() => {
					deleting = target.id;
					confirming = null;

					return async ({ result }) => {
						deleting = '';

						if (result.type === 'failure') {
							toast(String(result.data?.message ?? 'Could not delete that session.'), 'error');
							return;
						}

						if (result.type === 'success' && result.data?.history) {
							history = result.data.history as SessionHistoryEntry[];
						}

						toast('Session data deleted.', 'success');
					};
				}}
			>
				<input type="hidden" name="sessionId" value={target.id} />
				<button
					type="submit"
					class="w-full rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 pointer-coarse:py-3"
				>
					Delete
				</button>
			</form>
		</div>
	</div>
{/if}
