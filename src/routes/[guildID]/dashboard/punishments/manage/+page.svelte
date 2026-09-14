<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Pager from '$lib/components/Pager.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import { guildData } from '$lib/dashboardData.svelte';
	import { tone } from '$lib/panelClient.svelte';
	import { Punishments, perPage } from '$lib/punishments.svelte';
	import { exactTime, relativeTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { Moderation } from '$lib/server/panel';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const searchDelay = 300;
	const base = $derived(`/${data.guild.id}/panel/api`);
	const history = untrack(() => new Punishments(base));

	let query = $state('');
	let type = $state('');
	let pending = $state(false);
	let editing = $state<Moderation | null>(null);
	let removing = $state<Moderation | null>(null);
	let reason = $state('');
	let editType = $state('');

	const typeOptions = $derived([
		{ value: '', label: 'All types' },
		...data.types.map((name) => ({ value: name, label: name }))
	]);

	const editOptions = $derived(data.types.map((name) => ({ value: name, label: name })));

	$effect(() => {
		const filters = { type, username: query.trim(), userId: '' };

		const timer = setTimeout(() => history.apply(filters), searchDelay);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const page = history.page;
		untrack(() => history.ensure(page));
	});

	const pinned = $derived(history.showBolos ? history.bolos : []);
	const shown = $derived(history.shown);
	const empty = $derived(!pinned.length && !shown.length);

	async function send(body: Record<string, unknown>): Promise<boolean> {
		pending = true;

		try {
			const response = await fetch(base, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});

			const reply = (await response.json().catch(() => ({}))) as {
				ok?: boolean;
				message?: string;
			};

			if (!response.ok || reply.ok === false) {
				toast(reply.message || 'That action failed, try again shortly.', 'error');
				return false;
			}

			toast(reply.message || 'Punishment updated.', 'success');
			return true;
		} catch {
			toast('Could not reach the bot, try again shortly.', 'error');
			return false;
		} finally {
			pending = false;
		}
	}

	function edit(entry: Moderation) {
		editing = entry;
		reason = entry.reason;
		editType = entry.type;
	}

	async function save() {
		if (!editing || !reason.trim()) return;

		const done = await send({
			action: 'moderation.update',
			id: editing.id,
			reason: reason.trim(),
			type: editType
		});

		if (done) {
			editing = null;
			history.refresh();
		}
	}

	async function remove() {
		if (!removing) return;

		const done = await send({ action: 'moderation.delete', id: removing.id });

		if (done) {
			removing = null;
			history.refresh();
		}
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;
		editing = null;
		removing = null;
	}}
/>

<svelte:head><title>Manage Punishments - {guildData.name}</title></svelte:head>

<Card
	title="Punishments"
	description="Every punishment logged in this server, newest first. Edit a reason or remove one entirely."
>
	<div class="flex flex-col gap-3 border-b border-line px-6 py-4 sm:flex-row">
		<div
			class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-white/5 px-3"
		>
			<Search class="h-4 w-4 shrink-0 text-muted" />
			<input
				bind:value={query}
				placeholder="Search by player"
				aria-label="Search punishments by player"
				autocomplete="off"
				class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
			/>
		</div>

		<div class="shrink-0 sm:w-56">
			<Select options={typeOptions} bind:value={type} placeholder="All types" />
		</div>
	</div>

	{#if empty}
		<p class="px-6 py-10 text-center text-sm text-muted">
			{#if history.loading || !history.ready}
				Loading punishments...
			{:else if history.failed}
				Your punishments are unavailable right now. Reload in a moment.
			{:else if query || type}
				No punishments match those filters.
			{:else}
				No punishments logged yet.
			{/if}
		</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm md:min-w-160">
				<thead class="text-xs tracking-wide text-muted uppercase">
					<tr class="border-b border-line">
						<th scope="col" class="px-3 py-3 font-medium md:px-6">Player</th>
						<th scope="col" class="px-3 py-3 font-medium md:px-6">Type</th>
						<th scope="col" class="hidden px-3 py-3 font-medium md:table-cell md:px-6">Reason</th>
						<th scope="col" class="hidden px-3 py-3 font-medium md:table-cell md:px-6">
							Moderator
						</th>
						<th scope="col" class="px-3 py-3 font-medium md:px-6">When</th>
						<th scope="col" class="px-3 py-3 font-medium md:px-6">
							<span class="sr-only">Actions</span>
						</th>
					</tr>
				</thead>

				<tbody class="divide-y divide-line">
					{#each [...pinned, ...shown] as entry (entry.id)}
						<tr>
							<td class="px-3 py-3 md:px-6">
								<span class="font-medium">{entry.username}</span>

								<span class="mt-1 block text-xs text-muted md:hidden">
									<span class="line-clamp-2">{entry.reason}</span>
									<span class="mt-0.5 block">By {entry.moderator}</span>
								</span>
							</td>

							<td class="px-3 py-3 md:px-6">
								<span
									class="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium {tone(
										entry.type
									)}"
								>
									{entry.type}
								</span>
							</td>

							<td class="hidden max-w-80 px-3 py-3 text-muted md:table-cell md:px-6">
								<span class="line-clamp-2">{entry.reason}</span>
							</td>

							<td class="hidden px-3 py-3 text-muted md:table-cell md:px-6">{entry.moderator}</td>

							<td class="px-3 py-3 text-muted md:px-6">
								<Tooltip text={exactTime(entry.epoch)}>
									{relativeTime(entry.epoch)}
								</Tooltip>
							</td>

							<td class="px-3 py-3 md:px-6">
								<div class="flex shrink-0 justify-end gap-1">
									<button
										type="button"
										onclick={() => edit(entry)}
										aria-label="Edit the {entry.type} for {entry.username}"
										class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white pointer-coarse:p-3"
									>
										<Pencil class="h-4 w-4" />
									</button>

									<button
										type="button"
										onclick={() => (removing = entry)}
										aria-label="Delete the {entry.type} for {entry.username}"
										class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-red-300 pointer-coarse:p-3"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<Pager total={history.total} {perPage} bind:page={history.page} label="punishments" />
	{/if}
</Card>

{#if editing}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (editing = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-100 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">Edit punishment</h2>
		<p class="mt-2 text-sm text-muted">
			{editing.type} issued to {editing.username} by {editing.moderator}.
		</p>

		<div class="mt-5 flex flex-col gap-5">
			<Field label="Type" description="What this punishment counts as on their record.">
				<Select options={editOptions} bind:value={editType} placeholder="Select a type" />
			</Field>

			<Field label="Reason" description="Shown to the player and in your logs.">
				<textarea
					bind:value={reason}
					rows="3"
					aria-label="Punishment reason"
					class="w-full resize-none rounded-lg border border-line bg-white/5 px-3 py-2 text-sm focus:border-line focus:ring-0"
				></textarea>
			</Field>
		</div>

		<div class="mt-6 flex gap-2">
			<button
				type="button"
				onclick={() => (editing = null)}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={save}
				disabled={pending || !reason.trim()}
				class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				Save
			</button>
		</div>
	</div>
{/if}

{#if removing}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (removing = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-88 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">Delete punishment</h2>
		<p class="mt-2 text-sm text-muted">
			The {removing.type} issued to {removing.username} is removed from their record for good.
		</p>

		<div class="mt-6 flex gap-2">
			<button
				type="button"
				onclick={() => (removing = null)}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={remove}
				disabled={pending}
				class="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				Delete
			</button>
		</div>
	</div>
{/if}
