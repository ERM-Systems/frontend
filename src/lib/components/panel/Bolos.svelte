<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Search from '@lucide/svelte/icons/search';
	import Zap from '@lucide/svelte/icons/zap';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade, fly } from 'svelte/transition';
	import { ago, type Panel } from '$lib/panelClient.svelte';
	import { exactTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { Moderation } from '$lib/server/panel';

	let { panel, now }: { panel: Panel; now: number } = $props();

	const limit = 50;
	const banDelay = 3000;

	let rows = $state<Moderation[]>([]);
	let loading = $state(true);
	let failed = $state(false);
	let sweeping = $state(false);
	let running = $state(false);
	let stopped = $state('');
	let done = $state(0);
	let total = $state(0);
	let search = $state('');
	let queue = $state<Moderation[]>([]);
	let progress = $state<Record<string, 'pending' | 'success' | 'error' | 'skipped'>>({});

	const selected = new SvelteSet<string>();

	const active = $derived(
		rows.filter((entry) => !entry.reason.toLowerCase().includes('marked as complete'))
	);

	const percent = $derived(total ? Math.round((done / total) * 100) : 0);

	const listed = $derived.by(() => {
		const term = search.trim().toLowerCase();
		if (!term) return active;

		return active.filter(
			(entry) =>
				entry.username.toLowerCase().includes(term) || entry.reason.toLowerCase().includes(term)
		);
	});

	async function load() {
		try {
			const response = await fetch(
				`${panel.base}?feed=moderations&type=BOLO&skip=0&limit=${limit}`,
				{ cache: 'no-store' }
			);

			if (!response.ok) throw new Error(String(response.status));

			const page = (await response.json()) as { rows: Moderation[] };

			rows = page.rows;
			failed = false;
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	const signature = $derived(
		panel.snapshot.moderations.map((entry) => `${entry.id}:${entry.type}`).join()
	);

	$effect(() => {
		void signature;
		if (running || sweeping) return;

		untrack(() => void load());
	});

	function begin() {
		selected.clear();
		for (const entry of active) selected.add(entry.id);

		progress = {};
		queue = [];
		stopped = '';
		search = '';
		done = 0;
		total = 0;
		sweeping = true;
	}

	function close() {
		if (running) return;
		sweeping = false;
	}

	function toggle(id: string) {
		if (!selected.delete(id)) selected.add(id);
	}

	async function send(body: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
		try {
			const response = await fetch(panel.base, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			const reply = (await response.json().catch(() => null)) as {
				ok?: boolean;
				message?: string;
			} | null;

			if (!reply) return { ok: false, message: 'The bot did not answer.' };

			return {
				ok: response.ok && reply.ok !== false,
				message: reply.message ?? 'That request failed.'
			};
		} catch {
			return { ok: false, message: 'Could not reach the bot.' };
		}
	}

	const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	async function complete(entry: Moderation) {
		const ok = await panel.act(`complete:${entry.id}`, {
			action: 'moderation.complete',
			id: entry.id,
			username: entry.username,
			reason: entry.reason,
			moderator: entry.moderator
		});

		if (ok) await load();
	}

	async function sweep() {
		const targets = active.filter((entry) => selected.has(entry.id));
		if (!targets.length || running) return;

		running = true;
		progress = {};
		queue = targets;
		stopped = '';
		done = 0;
		total = targets.length;

		for (const [index, entry] of targets.entries()) {
			progress = { ...progress, [entry.id]: 'pending' };

			const banned = await send({
				action: 'player',
				command: 'ban',
				playerId: entry.userId,
				username: entry.username
			});

			const marked = banned.ok
				? await send({
						action: 'moderation.complete',
						id: entry.id,
						username: entry.username,
						reason: entry.reason,
						moderator: entry.moderator
					})
				: banned;

			if (!marked.ok) {
				progress = { ...progress, [entry.id]: 'error' };
				stopped = marked.message;

				for (const rest of targets.slice(index + 1)) {
					progress = { ...progress, [rest.id]: 'skipped' };
				}

				break;
			}

			progress = { ...progress, [entry.id]: 'success' };
			done += 1;

			if (index < targets.length - 1) await pause(banDelay);
		}

		running = false;
		await load();

		if (stopped) {
			toast(`Stopped after ${done} of ${total}. ${stopped}`, 'error');
			return;
		}

		toast(`Banned and completed ${done} BOLO${done === 1 ? '' : 's'}.`, 'success');
		sweeping = false;
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && close()} />

{#if active.length && panel.canEditPunishments}
	<div class="flex items-center gap-2 border-b border-line px-5 py-3">
		<p class="min-w-0 flex-1 truncate text-xs text-muted">
			{active.length} active BOLO{active.length === 1 ? '' : 's'}
		</p>

		<button
			type="button"
			onclick={begin}
			class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white/5 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10"
		>
			<Zap class="h-3.5 w-3.5" />
			Auto-complete
		</button>
	</div>
{/if}

<ul class="divide-y divide-line">
	{#each active as entry (entry.id)}
		<li class="flex items-start gap-3 px-5 py-4">
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{entry.username}</p>
				<p class="mt-0.5 text-sm wrap-break-word text-muted">{entry.reason}</p>
				<p class="mt-1 text-xs text-muted">{ago(entry.epoch, now)} - by {entry.moderator}</p>
			</div>

			{#if panel.canEditPunishments}
				<button
					type="button"
					onclick={() => complete(entry)}
					disabled={!!panel.pending}
					aria-label="Mark the BOLO for {entry.username} as complete"
					class="tap shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-green-300 disabled:opacity-50"
				>
					<Check class="h-4 w-4" />
				</button>
			{/if}
		</li>
	{:else}
		<li class="px-5 py-8 text-center text-sm text-muted">
			{#if loading}
				Loading BOLOs...
			{:else if failed}
				Your BOLOs are unavailable right now.
			{:else}
				No BOLOs are active.
			{/if}
		</li>
	{/each}
</ul>

{#if sweeping}
	<div
		class="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={close}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-100 flex max-h-[calc(100dvh-4rem)] w-110 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface"
		role="dialog"
		aria-modal="true"
		aria-label="Auto-complete BOLOs"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<header class="shrink-0 border-b border-line px-6 py-5">
			<h2 class="text-sm font-semibold tracking-wide">Auto-complete BOLOs</h2>
			<p class="mt-1 text-sm text-muted">
				Each selected player is banned in game, then their BOLO is marked complete. If any request
				fails the whole run stops.
			</p>
		</header>

		{#if total}
			<div class="shrink-0 border-b border-line px-6 py-4">
				<div class="flex items-center justify-between text-xs text-muted">
					<span>{done} of {total} completed</span>
					<span class="tabular-nums">{percent}%</span>
				</div>

				<div class="mt-2 flex h-1.5 gap-0.5">
					{#each queue as entry (entry.id)}
						<div
							class="h-full flex-1 rounded-full transition-colors duration-300 {progress[
								entry.id
							] === 'success'
								? 'bg-white'
								: progress[entry.id] === 'error' || progress[entry.id] === 'skipped'
									? 'bg-red-500'
									: 'bg-white/8'}"
						></div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="shrink-0 border-b border-line px-6 py-4">
			<div class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3">
				<Search class="h-4 w-4 shrink-0 text-muted" />
				<input
					bind:value={search}
					placeholder="Search by player or reason"
					aria-label="Search BOLOs"
					autocomplete="off"
					class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
				/>
			</div>
		</div>

		<ul class="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
			{#each listed as entry (entry.id)}
				<li
					class="flex items-start gap-3 px-6 py-3 {progress[entry.id] === 'error'
						? 'border-l-2 border-l-red-500 bg-red-500/8'
						: ''}"
				>
					<input
						type="checkbox"
						checked={selected.has(entry.id)}
						onchange={() => toggle(entry.id)}
						disabled={running}
						aria-label="Include the BOLO for {entry.username}"
						class="mt-1 h-4 w-4 shrink-0 rounded border-line bg-white/5 text-white focus:ring-0 disabled:opacity-50"
					/>

					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{entry.username}</p>
						<p class="mt-0.5 text-sm wrap-break-word text-muted">{entry.reason}</p>
						<p class="mt-1 text-xs text-muted">
							{exactTime(entry.epoch)} - {ago(entry.epoch, now)} - by {entry.moderator}
						</p>
					</div>

					{#if progress[entry.id]}
						<span
							class="shrink-0 text-xs {progress[entry.id] === 'success'
								? 'text-green-300'
								: progress[entry.id] === 'error'
									? 'text-red-300'
									: 'text-muted'}"
						>
							{progress[entry.id] === 'success'
								? 'Done'
								: progress[entry.id] === 'error'
									? 'Failed'
									: progress[entry.id] === 'skipped'
										? 'Skipped'
										: 'Working'}
						</span>
					{/if}
				</li>
			{:else}
				<li class="px-6 py-8 text-center text-sm text-muted">
					{search ? 'No BOLOs match that search.' : 'No BOLOs are active.'}
				</li>
			{/each}
		</ul>

		<div class="flex shrink-0 gap-2 border-t border-line px-6 py-4">
			<button
				type="button"
				onclick={close}
				disabled={running}
				class="flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50 pointer-coarse:py-3"
			>
				{stopped ? 'Close' : 'Cancel'}
			</button>

			<button
				type="button"
				onclick={sweep}
				disabled={running || !selected.size}
				class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:opacity-50 pointer-coarse:py-3"
			>
				{running ? 'Working...' : `Complete ${selected.size}`}
			</button>
		</div>
	</div>
{/if}
