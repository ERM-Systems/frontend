<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { onDestroy } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { deserialize } from '$app/forms';
	import { toast } from '$lib/toast.svelte';
	import type { HistoricLog, RollbackAction, RollbackProgress } from '$lib/server/settings';

	const reversible = [
		{ value: 'ban', label: 'Bans' },
		{ value: 'unban', label: 'Unbans' },
		{ value: 'admin', label: 'Admin grants' },
		{ value: 'unadmin', label: 'Admin removals' },
		{ value: 'mod', label: 'Mod grants' },
		{ value: 'unmod', label: 'Mod removals' }
	];

	let logs = $state<HistoricLog[]>([]);
	let fetching = $state(false);
	let selected = $state<HistoricLog | null>(null);
	let omitted = $state<string[]>([]);
	let actions = $state<RollbackAction[]>([]);
	let analysing = $state(false);
	let starting = $state(false);
	let progress = $state<RollbackProgress | null>(null);
	let timer: ReturnType<typeof setInterval> | null = null;

	async function post(name: string, body: Record<string, string> = {}) {
		const data = new FormData();
		for (const [key, value] of Object.entries(body)) data.append(key, value);

		const response = await fetch(`?/${name}`, {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body: data
		});

		const result = deserialize(await response.text());
		if (result.type === 'success') return (result.data ?? {}) as Record<string, unknown>;

		if (result.type === 'failure') {
			toast(String(result.data?.message ?? 'That did not work, try again.'), 'error');
		}

		return null;
	}

	async function loadLogs() {
		fetching = true;
		const data = await post('logs');
		fetching = false;

		if (!data) return;

		logs = (data.logs ?? []) as HistoricLog[];
		if (!logs.length) toast('No command history has been saved for this server yet.', 'error');
	}

	async function analyse() {
		if (!selected) return;

		analysing = true;
		const data = await post('premortem', {
			time: String(selected.timestamp),
			omit: omitted.join(',')
		});
		analysing = false;

		if (!data) return;
		actions = (data.actions ?? []) as RollbackAction[];
	}

	function open(log: HistoricLog) {
		selected = log;
		omitted = [];
		actions = [];
		progress = null;
		analyse();
	}

	function stop() {
		if (!timer) return;
		clearInterval(timer);
		timer = null;
	}

	function close() {
		if (progress?.in_progress) return;

		stop();
		selected = null;
		actions = [];
		progress = null;
	}

	function toggle(value: string) {
		omitted = omitted.includes(value)
			? omitted.filter((entry) => entry !== value)
			: [...omitted, value];

		analyse();
	}

	async function poll() {
		const data = await post('progress');
		if (!data) return;

		const next = data.progress as RollbackProgress;
		progress = next;
		if (next.in_progress) return;

		stop();
		toast(
			`Rollback finished with ${next.success_count} reversed and ${next.failure_count} failed.`,
			next.failure_count ? 'error' : 'success'
		);
	}

	async function start() {
		if (!selected) return;

		starting = true;
		const data = await post('rollback', {
			time: String(selected.timestamp),
			omit: omitted.join(',')
		});
		starting = false;

		if (!data) return;

		progress = data.progress as RollbackProgress;
		stop();
		timer = setInterval(poll, 2000);
	}

	onDestroy(stop);

	const estimate = $derived.by(() => {
		const seconds = actions.length * 2;
		if (seconds < 60) return `${seconds} seconds`;

		const minutes = Math.round(seconds / 60);
		return `${minutes} minute${minutes === 1 ? '' : 's'}`;
	});

	function moment(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleString();
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') close();
	}}
/>

<div class="px-6 py-5">
	<button
		type="button"
		onclick={loadLogs}
		disabled={fetching}
		class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
	>
		{#if fetching}
			<LoaderCircle class="h-4 w-4 animate-spin" />
		{/if}
		{fetching ? 'Loading history...' : logs.length ? 'Reload history' : 'Load command history'}
	</button>

	{#if logs.length}
		<ul
			class="mt-4 max-h-96 divide-y divide-line overflow-y-auto rounded-xl border border-line"
			transition:slide={{ duration: 200 }}
		>
			{#each logs as log (log.timestamp + log.command)}
				<li>
					<button
						type="button"
						onclick={() => open(log)}
						class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-white/5"
					>
						<span class="font-medium">{log.username}</span>

						{#if log.is_automated}
							<span class="rounded-full bg-white/8 px-2 py-0.5 text-xs text-muted">
								Automated
							</span>
						{/if}

						<span class="ml-auto text-sm text-muted">{moment(log.timestamp)}</span>

						<span class="w-full truncate font-mono text-sm text-muted">{log.command}</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-3 text-sm text-muted">
			Load your saved command history, then pick the moment you want to roll back to. Everything
			reversible up to and including that command is undone.
		</p>
	{/if}
</div>

{#if selected}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={close}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 flex max-h-[85vh] w-160 max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<div class="flex items-start gap-4 border-b border-line px-6 py-5">
			<div class="min-w-0 flex-1">
				<h2 class="font-semibold">Roll back to {moment(selected.timestamp)}</h2>
				<p class="mt-1 truncate font-mono text-sm text-muted">{selected.command}</p>
			</div>

			<button
				type="button"
				onclick={close}
				disabled={progress?.in_progress}
				aria-label="Close"
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<div class="overflow-y-auto">
			{#if progress}
				<div class="px-6 py-5">
					<div class="h-2 overflow-hidden rounded-full bg-white/8">
						<div
							class="h-full rounded-full bg-red-500 transition-[width] duration-300"
							style="width: {Math.min(100, Math.round(progress.percent_done))}%"
						></div>
					</div>

					<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
						<span>{progress.completed_count} of {progress.total_commands} done</span>
						<span>{progress.success_count} reversed</span>
						<span>{progress.failure_count} failed</span>
					</div>

					{#if progress.error}
						<p class="mt-3 text-sm text-red-400">{progress.error}</p>
					{/if}
				</div>

				<ul class="divide-y divide-line border-t border-line">
					{#each progress.commands as command (command.command)}
						<li class="flex items-center gap-3 px-6 py-3">
							<span class="min-w-0 flex-1 truncate font-mono text-sm">{command.command}</span>

							{#if command.completed}
								{#if command.success}
									<Check class="h-4 w-4 shrink-0 text-green-500" />
								{:else}
									<X class="h-4 w-4 shrink-0 text-red-400" />
								{/if}
							{:else if progress.current_command === command.command}
								<LoaderCircle class="h-4 w-4 shrink-0 animate-spin text-muted" />
							{:else}
								<span class="text-xs text-muted">Queued</span>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<div class="border-b border-line px-6 py-5">
					<p class="text-sm font-medium">Command types to skip</p>
					<p class="mt-1 text-sm text-muted">Anything selected here is left exactly as it is.</p>

					<div class="mt-3 flex flex-wrap gap-2">
						{#each reversible as command (command.value)}
							{@const skipped = omitted.includes(command.value)}
							<button
								type="button"
								onclick={() => toggle(command.value)}
								disabled={analysing}
								class="rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 {skipped
									? 'border-red-500/25 bg-red-500/10 text-red-400'
									: 'border-line bg-white/5 text-muted hover:bg-white/10'}"
							>
								{command.label}
							</button>
						{/each}
					</div>
				</div>

				{#if analysing}
					<div class="flex items-center justify-center gap-3 px-6 py-12 text-sm text-muted">
						<LoaderCircle class="h-4 w-4 animate-spin" />
						Working out what would be reversed...
					</div>
				{:else if actions.length}
					<div class="flex flex-wrap items-center gap-3 px-6 py-4 text-sm">
						<span class="font-medium">
							{actions.length} action{actions.length === 1 ? '' : 's'} will be reversed
						</span>
						<span class="text-muted">around {estimate} to finish</span>
					</div>

					<ul class="divide-y divide-line border-t border-line">
						{#each actions as action, index (index)}
							<li class="px-6 py-3">
								<p class="truncate font-mono text-sm">{action.reverse_command}</p>
								<p class="mt-1 truncate text-sm text-muted">
									Reverses {action.original_command} by {action.executed_by} at
									{moment(action.time_executed)}
								</p>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="px-6 py-12 text-center text-sm text-muted">
						Nothing reversible was found up to that point.
					</p>
				{/if}
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-3 border-t border-line px-6 py-4">
			{#if !progress && actions.length}
				<p class="flex min-w-0 flex-1 items-start gap-2 text-sm text-muted">
					<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
					<span class="min-w-0 flex-1">This cannot be undone.</span>
				</p>
			{:else}
				<div class="flex-1"></div>
			{/if}

			<button
				type="button"
				onclick={close}
				disabled={progress?.in_progress}
				class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				{progress && !progress.in_progress ? 'Done' : 'Cancel'}
			</button>

			{#if !progress}
				<button
					type="button"
					onclick={start}
					disabled={analysing || starting || !actions.length}
					class="flex items-center gap-2 rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{#if starting}
						<LoaderCircle class="h-4 w-4 animate-spin" />
					{/if}
					{starting ? 'Starting...' : 'Roll back'}
				</button>
			{/if}
		</div>
	</div>
{/if}
