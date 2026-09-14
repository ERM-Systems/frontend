<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Hash from '@lucide/svelte/icons/hash';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import User from '@lucide/svelte/icons/user';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Pager from '$lib/components/Pager.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import Filters from '$lib/components/panel/Filters.svelte';
	import Menu, { type MenuItem } from '$lib/components/panel/Menu.svelte';
	import ModerationInfo from '$lib/components/panel/ModerationInfo.svelte';
	import { ago, stamp, tone, type Panel } from '$lib/panelClient.svelte';
	import { Punishments, perPage } from '$lib/punishments.svelte';
	import { toast } from '$lib/toast.svelte';
	import type { Moderation } from '$lib/server/panel';

	let { panel, now, punishmentTypes }: { panel: Panel; now: number; punishmentTypes: string[] } =
		$props();

	let query = $state('');
	let type = $state('');
	let search = $state('');
	let from = $state('');
	let to = $state('');
	let editing = $state<Moderation | null>(null);
	let reason = $state('');
	let menu = $state<{ x: number; y: number; entry: Moderation } | null>(null);

	const searchDelay = 300;
	const history = untrack(() => new Punishments(panel.base));

	const typeOptions = $derived([
		{ value: '', label: 'All types' },
		...punishmentTypes.map((name) => ({ value: name, label: name }))
	]);

	const proofPattern = /\[([^\]]*)]\((https?:\/\/[^)\s]+)\)/g;

	function proofs(text: string): { label: string; url: string }[] {
		return [...text.matchAll(proofPattern)].map((match) => ({
			label: match[1] || 'Proof',
			url: match[2]
		}));
	}

	function clean(text: string): string {
		return text.replace(proofPattern, '').replace(/\s+/g, ' ').trim() || 'No reason given';
	}

	function isBolo(entry: Moderation): boolean {
		return entry.type.toLowerCase() === 'bolo';
	}

	$effect(() => {
		const filters = {
			type,
			username: query.trim(),
			userId: panel.focus?.id ?? '',
			reason: search.trim(),
			from,
			to
		};

		const timer = setTimeout(() => history.apply(filters), searchDelay);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const page = history.page;
		untrack(() => history.ensure(page));
	});

	const signature = $derived(
		panel.snapshot.moderations.map((entry) => `${entry.id}:${entry.type}`).join()
	);

	$effect(() => {
		void signature;
		untrack(() => history.refresh());
	});

	const shown = $derived(history.shown);
	const pinned = $derived(history.showBolos ? history.bolos : []);

	const focused = $derived(panel.focus?.id ?? '');
	const direction = $derived(focused ? 1 : -1);

	function edit(entry: Moderation) {
		editing = entry;
		reason = entry.reason;
	}

	async function save() {
		if (!editing) return;

		const done = await panel.act(`edit:${editing.id}`, {
			action: 'moderation.update',
			id: editing.id,
			reason,
			type: editing.type
		});

		if (done) {
			editing = null;
			history.refresh();
		}
	}

	async function remove(entry: Moderation) {
		const done = await panel.act(`delete:${entry.id}`, {
			action: 'moderation.delete',
			id: entry.id
		});

		if (done) history.refresh();
	}

	async function complete(entry: Moderation) {
		const done = await panel.act(`complete:${entry.id}`, {
			action: 'moderation.complete',
			id: entry.id,
			username: entry.username,
			reason: entry.reason,
			moderator: entry.moderator
		});

		if (done) history.refresh();
	}

	async function copy(label: string, value: string) {
		if (!value) {
			toast(`No ${label.toLowerCase()} to copy.`, 'error');
			return;
		}

		try {
			await navigator.clipboard.writeText(value);
			toast(`${label} copied.`, 'success');
		} catch {
			toast('Your browser blocked the clipboard.', 'error');
		}
	}

	const options = $derived.by(() => {
		const entry = menu?.entry;
		if (!entry) return [];

		const items: MenuItem[] = [
			{
				label: 'Copy moderator ID',
				icon: ShieldCheck,
				action: () => copy('Moderator ID', entry.moderatorId)
			},
			{ label: 'Copy Roblox ID', icon: Hash, action: () => copy('Roblox ID', entry.userId) },
			{
				label: 'Copy Roblox username',
				icon: User,
				action: () => copy('Roblox username', entry.username)
			},
			{
				label: 'Copy moderation ID',
				icon: Copy,
				action: () => copy('Moderation ID', entry.id)
			}
		];

		if (isBolo(entry) && panel.canEditPunishments) {
			items.push({
				label: 'Mark BOLO as completed',
				icon: Check,
				action: () => void complete(entry),
				divider: true
			});
		}

		return items;
	});

	function contextMenu(event: MouseEvent, entry: Moderation) {
		event.preventDefault();
		event.stopPropagation();

		menu = { x: event.clientX, y: event.clientY, entry };
	}
</script>

{#snippet row(entry: Moderation, bolo: boolean)}
	<li
		oncontextmenu={(event) => contextMenu(event, entry)}
		out:fade={{ duration: 140 }}
		class="px-5 py-3.5 {bolo ? 'border-l-2 border-l-red-500 bg-red-500/8' : ''}"
	>
		<div class="flex items-start gap-3">
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<span class="truncate text-sm font-medium">{entry.username}</span>
					<span
						class="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium {bolo
							? 'border-red-500/40 bg-red-500/15 text-red-300'
							: tone(entry.type)}"
					>
						{entry.type}
					</span>
				</div>

				<p class="mt-1 text-sm text-muted">{clean(entry.reason)}</p>

				{#each proofs(entry.reason) as proof (proof.url)}
					<a
						href={proof.url}
						rel="noreferrer noopener nofollow"
						target="_blank"
						class="mt-1.5 mr-1.5 inline-flex items-center gap-1.5 rounded-full border border-line bg-white/5 px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-white/10"
					>
						{proof.label}
						<ExternalLink class="h-3 w-3 text-muted" />
					</a>
				{/each}

				<Tooltip text={stamp(entry.epoch)}>
					<p class="mt-1.5 text-xs text-muted">
						{entry.moderator} - {ago(entry.epoch, now)}
					</p>
				</Tooltip>
			</div>

			<div class="flex shrink-0 gap-1">
				<ModerationInfo {panel} {entry} />

				{#if panel.canEditPunishments}
					<button
						type="button"
						onclick={() => edit(entry)}
						aria-label="Edit moderation for {entry.username}"
						class="tap rounded p-1.5 text-muted transition-colors hover:bg-white/8 hover:text-white"
					>
						<Pencil class="h-4 w-4" />
					</button>

					<button
						type="button"
						disabled={!!panel.pending}
						onclick={() => remove(entry)}
						aria-label="Delete moderation for {entry.username}"
						class="tap rounded p-1.5 text-muted transition-colors hover:bg-white/8 hover:text-red-300 disabled:opacity-50"
					>
						<Trash2 class="h-4 w-4" />
					</button>
				{/if}
			</div>
		</div>
	</li>
{/snippet}

{#if panel.focus}
	<div
		transition:fly={{ y: -8, duration: 160 }}
		class="flex items-center gap-2 border-b border-line bg-white/2 px-5 py-2.5"
	>
		<span class="min-w-0 flex-1 truncate text-xs text-muted">
			Showing only <span class="font-medium text-white">{panel.focus.username}</span>
		</span>

		<button
			type="button"
			onclick={() => (panel.focus = null)}
			class="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-white/5 px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-white/10"
		>
			Clear
			<X class="h-3 w-3" />
		</button>
	</div>
{/if}

<Filters
	bind:query
	bind:choice={type}
	bind:reason={search}
	bind:from
	bind:to
	placeholder="Search by player"
	label="Search punishments by player"
	options={typeOptions}
	choiceLabel="All types"
	reasonPlaceholder="Search by reason"
	dates
/>

{#key focused}
	<div in:fly={{ x: direction * 28, duration: 220, opacity: 0.2 }}>
		<ul class="divide-y divide-line">
			{#each pinned as entry (entry.id)}
				{@render row(entry, true)}
			{/each}

			{#each shown as entry (entry.id)}
				{@render row(entry, isBolo(entry))}
			{:else}
				{#if !pinned.length}
					<li class="px-5 py-12 text-center text-sm text-muted">
						{#if history.loading || !history.ready}
							Loading punishments...
						{:else if history.failed}
							Those punishments could not be loaded.
						{:else if query || type || search || from || to || panel.focus}
							No punishments match those filters.
						{:else}
							No punishments logged yet.
						{/if}
					</li>
				{/if}
			{/each}
		</ul>
	</div>
{/key}

<Pager total={history.total} {perPage} bind:page={history.page} label="punishments" />

{#if editing}
	<div class="sticky bottom-0 border-t border-line bg-surface px-5 py-4">
		<p class="text-xs text-muted">Editing {editing.type} for {editing.username}</p>

		<textarea
			bind:value={reason}
			rows="2"
			aria-label="Moderation reason"
			class="mt-2 w-full resize-none rounded-lg border border-line bg-white/5 px-3 py-2 text-sm focus:border-line focus:ring-0"
		></textarea>

		<div class="mt-2 flex gap-2">
			<button
				type="button"
				onclick={() => (editing = null)}
				class="flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
			>
				Cancel
			</button>

			<button
				type="button"
				disabled={!reason.trim() || !!panel.pending}
				onclick={save}
				class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:opacity-50 pointer-coarse:py-3"
			>
				Save
			</button>
		</div>
	</div>
{/if}

{#if menu}
	<Menu x={menu.x} y={menu.y} items={options} close={() => (menu = null)} />
{/if}
