<script lang="ts">
	import Info from '@lucide/svelte/icons/info';
	import LogIn from '@lucide/svelte/icons/log-in';
	import LogOut from '@lucide/svelte/icons/log-out';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Search from '@lucide/svelte/icons/search';
	import Siren from '@lucide/svelte/icons/siren';
	import Skull from '@lucide/svelte/icons/skull';
	import Terminal from '@lucide/svelte/icons/terminal';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { ago, type Panel } from '$lib/panelClient.svelte';
	import type { LogEntry, LogKind } from '$lib/server/panel';

	let { panel, now }: { panel: Panel; now: number } = $props();

	const tabs: { kind: LogKind | 'all'; label: string }[] = [
		{ kind: 'all', label: 'All' },
		{ kind: 'joins', label: 'Joins' },
		{ kind: 'kills', label: 'Kills' },
		{ kind: 'commands', label: 'Commands' },
		{ kind: 'calls', label: 'Mod calls' }
	];

	const tones: Record<LogKind, string> = {
		joins: 'text-green-300',
		kills: 'text-red-300',
		commands: 'text-blue-300',
		calls: 'text-yellow-300'
	};

	let kind = $state<LogKind | 'all'>('all');
	let query = $state('');
	let refreshing = $state(false);

	const entries = $derived(panel.snapshot.logs);

	async function reload() {
		if (refreshing) return;
		refreshing = true;

		await panel.ask(['logs']);

		refreshing = false;
	}

	const counts = $derived.by(() => {
		const totals: Record<string, number> = { all: entries.length };
		for (const entry of entries) totals[entry.kind] = (totals[entry.kind] ?? 0) + 1;

		return totals;
	});

	const visible = $derived.by(() => {
		const term = query.trim().toLowerCase();

		return entries
			.filter(
				(entry) =>
					(kind === 'all' || entry.kind === kind) &&
					(!term ||
						entry.actor.toLowerCase().includes(term) ||
						entry.subject.toLowerCase().includes(term) ||
						entry.detail.toLowerCase().includes(term))
			)
			.slice(0, 200);
	});

	function icon(entry: LogEntry) {
		if (entry.kind === 'kills') return Skull;
		if (entry.kind === 'commands') return Terminal;
		if (entry.kind === 'calls') return Siren;

		return entry.detail === 'joined' ? LogIn : LogOut;
	}
</script>

<div class="sticky top-0 z-10 bg-surface">
	<div class="flex items-center gap-1 border-b border-line px-3 py-2">
		<div class="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
			{#each tabs as tab (tab.kind)}
				<button
					type="button"
					onclick={() => (kind = tab.kind)}
					class="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors pointer-coarse:px-3 pointer-coarse:py-3.5 {kind ===
					tab.kind
						? 'bg-white/10 text-white'
						: 'text-muted hover:bg-white/5'}"
				>
					{tab.label}
					{#if counts[tab.kind]}
						<span class="ml-1 tabular-nums opacity-60">{counts[tab.kind]}</span>
					{/if}
				</button>
			{/each}
		</div>

		<button
			type="button"
			onclick={reload}
			aria-label="Reload logs"
			class="tap shrink-0 rounded p-1.5 text-muted transition-colors hover:bg-white/8 hover:text-white"
		>
			<RefreshCw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" />
		</button>
	</div>

	<div class="border-b border-line px-3 py-2">
		<div class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3">
			<Search class="h-4 w-4 shrink-0 text-muted" />
			<input
				bind:value={query}
				placeholder="Search logs"
				aria-label="Search logs"
				autocomplete="off"
				class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
			/>
		</div>
	</div>
</div>

{#if !entries.length}
	<p class="px-5 py-12 text-center text-sm text-muted">
		Nothing logged yet, or the game server is not reporting logs right now.
	</p>
{:else}
	<ul class="divide-y divide-line">
		{#each visible as entry (entry.id)}
			{@const Icon = icon(entry)}
			<li class="flex items-start gap-3 px-4 py-3">
				<Icon class="mt-0.5 h-4 w-4 shrink-0 {tones[entry.kind]}" />

				<div class="min-w-0 flex-1">
					<p class="text-sm wrap-break-word">
						<span class="font-medium">{entry.actor || 'Unknown'}</span>
						<span class="text-muted"> {entry.detail} </span>
						{#if entry.subject && entry.kind !== 'calls'}<span class="font-medium"
								>{entry.subject}</span
							>{/if}
					</p>
					<p class="mt-1 text-xs text-muted">{ago(entry.timestamp, now)}</p>
				</div>

				{#if entry.remoteBy}
					<span class="self-center">
						<Tooltip text="This command was done remotely and ran by @{entry.remoteBy}.">
							<Info class="block h-4 w-4 shrink-0 text-blue-300" />
						</Tooltip>
					</span>
				{:else if entry.kind === 'calls' && entry.subject}
					<span class="self-center">
						<Tooltip text="Answered in-game by {entry.subject}.">
							<Info class="block h-4 w-4 shrink-0 text-blue-300" />
						</Tooltip>
					</span>
				{/if}
			</li>
		{:else}
			<li class="px-5 py-12 text-center text-sm text-muted">
				{query ? 'Nothing matches that search.' : 'Nothing logged yet.'}
			</li>
		{/each}
	</ul>
{/if}
