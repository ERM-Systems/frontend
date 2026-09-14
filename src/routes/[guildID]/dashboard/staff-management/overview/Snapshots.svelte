<script lang="ts">
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { exactTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { ResolvedPathname } from '$app/types';
	import type { SavedCode } from '$lib/server/staff';

	let {
		open = $bindable(false),
		guildId,
		period,
		codes
	}: {
		open: boolean;
		guildId: string;
		period: string;
		codes: SavedCode[] | null;
	} = $props();

	let saving = $state(false);
	let busy = $state('');

	const href = (code: string) =>
		`/${guildId}/dashboard/staff-management/overview?period=${period}&code=${code}` as ResolvedPathname;

	function close() {
		if (!saving && !busy) open = false;
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={close}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 flex max-h-[calc(100vh-4rem)] w-lg max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">Shift snapshots</h2>
		<p class="mt-2 text-sm text-muted">
			A snapshot freezes every shift in this server behind a code. Load one to read it here, or
			restore it to write those shifts back over the live data.
		</p>

		<form
			method="POST"
			action="?/saveSnapshot"
			use:enhance={() => {
				saving = true;

				return async ({ result }) => {
					saving = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not save a snapshot.'), 'error');
						return;
					}

					await invalidateAll();

					const code = result.type === 'success' ? String(result.data?.code ?? '') : '';
					toast(code ? `Snapshot saved as ${code}.` : 'Snapshot saved.', 'success');
				};
			}}
			class="mt-5"
		>
			<button
				type="submit"
				disabled={saving}
				class="w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				{saving ? 'Saving...' : 'Save a snapshot now'}
			</button>
		</form>

		<div class="mt-5 min-h-0 flex-1 overflow-y-auto rounded-lg border border-line">
			{#if !codes}
				<p class="px-4 py-8 text-center text-sm text-muted">
					Your snapshots are unavailable right now. Reload in a moment.
				</p>
			{:else if !codes.length}
				<p class="px-4 py-8 text-center text-sm text-muted">No snapshots saved yet.</p>
			{:else}
				<ul class="divide-y divide-line">
					{#each codes as entry (entry.code)}
						<li class="flex flex-wrap items-center gap-3 px-4 py-3">
							<div class="min-w-0 flex-1">
								<p class="font-mono text-sm">{entry.code}</p>
								<p class="text-xs text-muted">{exactTime(entry.createdAt)}</p>
							</div>

							<a
								href={href(entry.code)}
								onclick={() => (open = false)}
								class="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
							>
								Load
							</a>

							<form
								method="POST"
								action="?/restoreSnapshot"
								use:enhance={() => {
									busy = entry.code;

									return async ({ result }) => {
										busy = '';

										if (result.type === 'failure') {
											toast(
												String(result.data?.message ?? 'Could not restore that snapshot.'),
												'error'
											);
											return;
										}

										await invalidateAll();
										toast('Shifts restored from that snapshot.', 'success');
									};
								}}
							>
								<input type="hidden" name="code" value={entry.code} />
								<button
									type="submit"
									disabled={busy === entry.code}
									class="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
								>
									Restore
								</button>
							</form>

							<form
								method="POST"
								action="?/deleteSnapshot"
								use:enhance={() => {
									busy = entry.code;

									return async ({ result }) => {
										busy = '';

										if (result.type === 'failure') {
											toast(
												String(result.data?.message ?? 'Could not delete that snapshot.'),
												'error'
											);
											return;
										}

										await invalidateAll();
										toast('Snapshot deleted.', 'success');
									};
								}}
							>
								<input type="hidden" name="code" value={entry.code} />
								<button
									type="submit"
									disabled={busy === entry.code}
									aria-label="Delete snapshot {entry.code}"
									class="tap inline-flex items-center rounded-md border border-line bg-white/5 p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
								>
									<Trash2 class="h-3.5 w-3.5" />
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<button
			type="button"
			onclick={close}
			class="mt-5 w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
		>
			Close
		</button>
	</div>
{/if}
