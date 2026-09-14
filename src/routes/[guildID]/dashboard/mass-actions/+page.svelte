<script lang="ts">
	import Gavel from '@lucide/svelte/icons/gavel';
	import Search from '@lucide/svelte/icons/search';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { fade, fly } from 'svelte/transition';
	import { SvelteSet } from 'svelte/reactivity';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import { exactTime, relativeTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Stage = '' | 'list' | 'confirm';

	let stage = $state<Stage>('');
	let running = $state(false);
	let outcome = $state<{ message: string; failed: boolean } | null>(null);
	let search = $state('');

	const excluded = new SvelteSet<string>();

	const online = $derived(data.server.status === 'ok' && data.server.currentPlayers > 0);
	const selected = $derived(data.players.filter((entry) => !excluded.has(entry.id)));

	const listed = $derived.by(() => {
		const term = search.trim().toLowerCase();
		if (!term) return data.players;

		return data.players.filter(
			(entry) =>
				entry.name.toLowerCase().includes(term) ||
				entry.id.includes(term) ||
				entry.reason.toLowerCase().includes(term)
		);
	});

	const cooling = $derived.by(() => {
		if (!data.wait) return '';

		const hours = Math.ceil(data.wait / 3600);
		if (hours > 1) return `Mass unban is on cooldown for another ${hours} hours.`;

		const minutes = Math.max(1, Math.ceil(data.wait / 60));
		return `Mass unban is on cooldown for another ${minutes} minute${minutes === 1 ? '' : 's'}.`;
	});

	const offline = $derived.by(() => {
		if (online) return '';

		return data.server.status === 'ok'
			? 'Nobody is in the server, so in game commands cannot run.'
			: data.server.message || 'The server is unreachable right now.';
	});

	const unavailable = $derived(cooling || offline);

	function open() {
		if (unavailable || !data.players.length) return;

		excluded.clear();
		search = '';
		outcome = null;
		stage = 'list';
	}

	function close() {
		if (running) return;
		stage = '';
	}

	function dismiss() {
		if (running) return;
		stage = stage === 'confirm' ? 'list' : '';
	}

	function toggle(id: string) {
		if (!excluded.delete(id)) excluded.add(id);
	}

	function submit() {
		running = true;
		stage = 'list';
		outcome = null;

		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			running = false;

			const failed = result.type === 'failure';
			const message = String(result.data?.message ?? (failed ? 'That did not work.' : 'Done.'));

			outcome = { message, failed };
			toast(message, failed ? 'error' : 'success');

			await invalidateAll();
			if (!failed) excluded.clear();
		};
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && dismiss()} />

<PageHeader description="Bulk actions that run in game against your ER:LC server." />

<div class="mt-8 flex flex-col gap-6">
	<Card title="Actions" description="Only management can run these, and each one is rate limited.">
		<ul class="divide-y divide-line">
			<li class="flex flex-wrap items-center gap-4 px-6 py-5">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5"
				>
					<Gavel class="h-4 w-4" />
				</div>

				<div class="min-w-60 flex-1">
					<p class="text-sm font-medium">Mass Unban</p>
					<p class="mt-0.5 text-sm text-muted">
						Lift every ban on the server at once, minus anyone you exclude. Runs once a day.
					</p>
					<p class="mt-1 text-xs text-muted">
						{data.players.length} player{data.players.length === 1 ? '' : 's'} banned
					</p>
				</div>

				<Tooltip text={unavailable}>
					<button
						type="button"
						onclick={open}
						disabled={!!unavailable || !data.players.length}
						class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
					>
						{#if unavailable}
							<TriangleAlert class="h-4 w-4 shrink-0 text-yellow-400" />
						{/if}
						Review bans
					</button>
				</Tooltip>
			</li>
		</ul>

		<Callout>Reasons and dates come from your punishment logs where a matching ban exists.</Callout>
	</Card>
</div>

{#if stage}
	<div
		class="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={close}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-100 flex max-h-[calc(100dvh-4rem)] w-150 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface"
		role="dialog"
		aria-modal="true"
		aria-label="Mass unban"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<header class="shrink-0 border-b border-line px-6 py-5">
			<h2 class="text-sm font-semibold tracking-wide">Mass Unban</h2>
			<p class="mt-1 text-sm text-muted">
				Everyone listed is unbanned in game unless you uncheck them.
			</p>
		</header>

		{#if running || outcome}
			<div class="shrink-0 border-b border-line px-6 py-4">
				<div class="flex items-center justify-between gap-4 text-xs">
					<span class={outcome?.failed ? 'text-red-300' : 'text-muted'}>
						{#if running}
							Unbanning {selected.length} player{selected.length === 1 ? '' : 's'}...
						{:else}
							{outcome?.message}
						{/if}
					</span>

					{#if running}
						<span class="shrink-0 text-muted tabular-nums">50 per command</span>
					{/if}
				</div>

				<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
					<div
						class="h-full w-full rounded-full transition-colors duration-300 {running
							? 'animate-pulse bg-white'
							: outcome?.failed
								? 'bg-red-500'
								: 'bg-green-400'}"
					></div>
				</div>
			</div>
		{/if}

		<div class="shrink-0 border-b border-line px-6 py-4">
			<div class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3">
				<Search class="h-4 w-4 shrink-0 text-muted" />
				<input
					bind:value={search}
					placeholder="Search by player, ID or reason"
					aria-label="Search banned players"
					autocomplete="off"
					disabled={running}
					class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 disabled:opacity-50"
				/>
			</div>
		</div>

		<ul class="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
			{#each listed as entry (entry.id)}
				<li class="flex items-start gap-3 px-6 py-3">
					<input
						type="checkbox"
						checked={!excluded.has(entry.id)}
						onchange={() => toggle(entry.id)}
						disabled={running}
						aria-label="Unban {entry.name}"
						class="mt-2.5 h-4 w-4 shrink-0 rounded border-line bg-white/5 text-white focus:ring-0 disabled:opacity-50"
					/>

					{#if entry.avatarUrl}
						<img
							src={entry.avatarUrl}
							alt=""
							class="h-9 w-9 shrink-0 rounded-lg border border-line bg-white/5 object-cover"
						/>
					{:else}
						<div class="h-9 w-9 shrink-0 rounded-lg border border-line bg-white/5"></div>
					{/if}

					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{entry.name}</p>
						<p class="mt-0.5 text-sm wrap-break-word text-muted">
							{entry.reason || 'No matching punishment log.'}
						</p>
						<p class="mt-1 text-xs text-muted">
							{#if entry.epoch}
								{exactTime(entry.epoch)} - {relativeTime(entry.epoch)} - by {entry.moderator}
							{:else}
								Roblox ID {entry.id}
							{/if}
						</p>
					</div>
				</li>
			{:else}
				<li class="px-6 py-10 text-center text-sm text-muted">
					{search ? 'No banned players match that search.' : 'Nobody is banned on this server.'}
				</li>
			{/each}
		</ul>

		<div class="flex shrink-0 items-center gap-3 border-t border-line px-6 py-4">
			<p class="min-w-0 flex-1 truncate text-xs text-muted">
				{selected.length} of {data.players.length} selected
			</p>

			<button
				type="button"
				onclick={close}
				disabled={running}
				class="rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
			>
				Close
			</button>

			<button
				type="button"
				onclick={() => (stage = 'confirm')}
				disabled={running || !!unavailable || !selected.length}
				class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
			>
				{running ? 'Unbanning...' : `Unban all ${selected.length}`}
			</button>
		</div>
	</div>
{/if}

{#if stage === 'confirm'}
	<div
		class="fixed inset-0 z-110 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (stage = 'list')}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-120 w-100 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface"
		role="alertdialog"
		aria-modal="true"
		aria-label="Confirm the mass unban"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<div class="border-b border-line px-6 py-5">
			<h2 class="text-sm font-semibold tracking-wide">
				Unban {selected.length} player{selected.length === 1 ? '' : 's'}?
			</h2>
			<p class="mt-1 text-sm text-muted">
				This runs :unban in game against everyone you left checked, and locks mass unban for a day.
			</p>
		</div>

		<div class="flex gap-2 px-6 py-4">
			<button
				type="button"
				onclick={() => (stage = 'list')}
				class="flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10"
			>
				Go back
			</button>

			<form method="POST" action="?/unban" use:enhance={submit} class="flex-1">
				<input type="hidden" name="ids" value={selected.map((entry) => entry.id).join(',')} />

				<button
					type="submit"
					class="w-full rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-400/20"
				>
					Unban them
				</button>
			</form>
		</div>
	</div>
{/if}
