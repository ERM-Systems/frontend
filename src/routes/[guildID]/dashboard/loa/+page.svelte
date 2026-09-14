<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import History from '@lucide/svelte/icons/history';
	import Plus from '@lucide/svelte/icons/plus';
	import Square from '@lucide/svelte/icons/square';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Pager from '$lib/components/Pager.svelte';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import DatePicker, { isoDate } from '$lib/components/settings/DatePicker.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import TimePicker from '$lib/components/settings/TimePicker.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { dashboardHref } from '$lib/dashboard';
	import { editable } from '$lib/settingsForm.svelte';
	import { defaultAvatar, exactTime, pageSlice, relativeTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { LoaRecord } from '$lib/server/loa';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	const link = (slug: string) => dashboardHref(data.guild.id, slug);

	const now = Math.floor(Date.now() / 1000);
	const perPage = 10;

	const today = isoDate();

	const tabs = [
		{ id: 'active', label: 'Active' },
		{ id: 'review', label: 'Review' },
		{ id: 'previous', label: 'Previous' }
	];

	let tab = $state('active');
	let page = $state(1);
	let running = $state('');
	let copied = $state(false);

	let creating = $state(false);
	let denying = $state<LoaRecord | null>(null);
	let removing = $state<LoaRecord | null>(null);
	let viewing = $state<LoaRecord | null>(null);

	let newUserId = $state('');
	let newDate = $state('');
	let newTime = $state('12:00');
	let newReason = $state('');
	let denyReason = $state('');

	function finished(record: LoaRecord): boolean {
		return record.expired || record.expiry <= now;
	}

	const active = $derived(
		data.loas.filter((record) => record.accepted && !record.denied && !finished(record))
	);
	const review = $derived(
		data.loas.filter((record) => !record.accepted && !record.denied && !finished(record))
	);
	const previous = $derived(data.loas.filter((record) => record.denied || finished(record)));

	const rows = $derived(tab === 'active' ? active : tab === 'review' ? review : previous);
	const shown = $derived(pageSlice(rows, page, perPage));

	const history = $derived(
		viewing ? data.loas.filter((record) => record.userId === viewing?.userId) : []
	);

	const newExpiry = $derived(
		newDate ? Math.floor(new Date(`${newDate}T${newTime}`).getTime() / 1000) : 0
	);

	function name(record: LoaRecord): string {
		return record.username || `User ${record.userId}`;
	}

	function status(record: LoaRecord): { label: string; tone: string } {
		if (record.denied) return { label: 'Denied', tone: 'text-red-400' };
		if (finished(record)) return { label: 'Ended', tone: 'text-muted' };
		if (record.accepted) return { label: 'Active', tone: 'text-green-500' };

		return { label: 'Pending', tone: 'text-yellow-400' };
	}

	function control(action: string, done: string, after: () => void = () => {}) {
		running = action;

		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			running = '';

			if (result.type === 'failure') {
				toast(String(result.data?.message ?? 'That did not work.'), 'error');
				return;
			}

			after();
			await invalidateAll();
			toast(done, 'success');
		};
	}

	async function copyLink() {
		await navigator.clipboard.writeText(`${location.origin}/${data.guild.id}/panel/loa`);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function resetCreate() {
		creating = false;
		newUserId = '';
		newDate = '';
		newTime = '12:00';
		newReason = '';
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;

		denying = null;
		removing = null;
		viewing = null;
		creating = false;
	}}
/>

<PageHeader description="Full time off, with no quota expected while it lasts." />

{#snippet tile(label: string, value: number)}
	<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
		<p class="text-xs tracking-wide text-muted uppercase">{label}</p>
		<p class="mt-1 text-2xl font-semibold">{value}</p>
	</div>
{/snippet}

<div class="mt-8 flex flex-col gap-6">
	<Card title="Leave of Absence" description="How leave requests are handled.">
		{#snippet action()}
			<Switch bind:checked={form.value.enabled} label="Leave Requests" />
		{/snippet}

		<div
			class="divide-y divide-line transition-opacity {form.value.enabled
				? ''
				: 'pointer-events-none opacity-50'}"
			inert={!form.value.enabled}
		>
			<Row
				label="Requests Channel"
				description="Where leave requests are posted for approval. While it is empty requests cannot be filed."
			>
				<ChannelSelect bind:value={form.value.channel} placeholder="No channel" />
			</Row>

			<Row label="Leave of Absence Role" description="Applied while a staff member is on leave.">
				<Roles bind:selected={form.value.loa_role} placeholder="No role" single />
			</Row>
		</div>

		<Callout>
			Staff on leave are excused from their quota entirely. If you only want to lower it, use
			<a href={link('reduced-activity')} class="underline underline-offset-2 hover:text-white">
				Reduced Activity
			</a> instead, which has its own channel and toggle.
		</Callout>
	</Card>

	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		{@render tile('Total', data.loas.length)}
		{@render tile('Active', active.length)}
		{@render tile('Pending', review.length)}
		{@render tile('Denied', data.loas.filter((record) => record.denied).length)}
	</div>

	<Card title="Requests" description="Every leave request your server has on record.">
		{#snippet action()}
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={copyLink}
					class="flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
				>
					{#if copied}
						<Check class="h-4 w-4" />
						Copied
					{:else}
						<Copy class="h-4 w-4" />
						Copy request link
					{/if}
				</button>

				<button
					type="button"
					onclick={() => (creating = true)}
					class="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
				>
					<Plus class="h-4 w-4" />
					Create
				</button>
			</div>
		{/snippet}

		<div class="flex flex-wrap gap-1 border-b border-line px-6 py-4">
			{#each tabs as entry (entry.id)}
				<button
					type="button"
					onclick={() => {
						tab = entry.id;
						page = 1;
					}}
					aria-current={tab === entry.id ? 'page' : undefined}
					class="rounded-md px-3 py-1.5 text-sm transition-colors pointer-coarse:py-3 {tab ===
					entry.id
						? 'bg-white/8 font-medium text-white'
						: 'text-muted hover:bg-white/5 hover:text-white'}"
				>
					{entry.label}
				</button>
			{/each}
		</div>

		{#if !rows.length}
			<p class="px-6 py-8 text-center text-sm text-muted">
				{tab === 'review'
					? 'Nothing is waiting for a decision right now.'
					: tab === 'active'
						? 'Nobody is on leave right now.'
						: 'No leave has ended yet.'}
			</p>
		{:else}
			<div class="divide-y divide-line">
				{#each shown as record (record.id)}
					{@const state_ = status(record)}
					<div class="flex flex-wrap items-center gap-4 px-6 py-4">
						<img
							src={record.avatarUrl || defaultAvatar(record.userId)}
							alt=""
							loading="lazy"
							onerror={(event) => {
								const image = event.currentTarget as HTMLImageElement;
								const fallback = defaultAvatar(record.userId);
								if (image.src !== fallback) image.src = fallback;
							}}
							class="h-9 w-9 shrink-0 rounded-lg bg-white/8 object-cover"
						/>

						<div class="min-w-40 flex-1">
							<p class="flex items-center gap-2 font-medium">
								{name(record)}
								<span class="text-xs font-normal {state_.tone}">{state_.label}</span>
							</p>
							<p class="mt-1 truncate text-sm text-muted">{record.reason}</p>
							<p class="mt-1 text-xs text-muted">
								{finished(record) ? 'Ended' : 'Ends'}
								{relativeTime(record.expiry)} &middot; {exactTime(record.expiry)}
							</p>
						</div>

						<div class="flex items-center gap-2">
							{#if !record.accepted && !record.denied && !finished(record)}
								<form
									method="POST"
									action="?/accept"
									use:enhance={() => control(record.id, 'Leave request accepted.')}
								>
									<input type="hidden" name="loaId" value={record.id} />
									<button
										type="submit"
										disabled={running !== ''}
										class="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
									>
										<Check class="h-4 w-4" />
										Accept
									</button>
								</form>

								<button
									type="button"
									onclick={() => {
										denying = record;
										denyReason = '';
									}}
									class="flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
								>
									<X class="h-4 w-4" />
									Deny
								</button>
							{/if}

							{#if record.accepted && !record.denied && !finished(record)}
								<form
									method="POST"
									action="?/end"
									use:enhance={() => control(record.id, 'Leave ended.')}
								>
									<input type="hidden" name="loaId" value={record.id} />
									<input
										type="hidden"
										name="forced"
										value={record.userId === data.viewerId ? 'false' : 'true'}
									/>
									<button
										type="submit"
										disabled={running !== ''}
										class="flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
									>
										<Square class="h-4 w-4" />
										{record.userId === data.viewerId ? 'End' : 'Force end'}
									</button>
								</form>
							{/if}

							<button
								type="button"
								onclick={() => (viewing = record)}
								aria-label="Show this member's leave history"
								class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
							>
								<History class="h-4 w-4" />
							</button>

							<button
								type="button"
								onclick={() => (removing = record)}
								aria-label="Delete this leave"
								class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-red-400"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
				{/each}
			</div>

			<Pager total={rows.length} {perPage} bind:page label="requests" />
		{/if}
	</Card>
</div>

<SaveBar {form} />

{#if creating}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={resetCreate}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-md max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="create-loa-title"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 id="create-loa-title" class="text-lg font-semibold">Create a leave</h2>
		<p class="mt-2 text-sm text-muted">
			Leave the Discord ID empty to file this leave for yourself. Either way it goes to review
			before it starts.
		</p>

		<form
			method="POST"
			action="?/create"
			use:enhance={() => control('create', 'Leave created.', resetCreate)}
			class="mt-5 flex flex-col gap-4"
		>
			<input type="hidden" name="expiry" value={newExpiry} />
			<input type="hidden" name="userId" value={newUserId} />
			<input type="hidden" name="reason" value={newReason} />

			<label class="flex flex-col gap-2 text-sm font-medium">
				Discord ID
				<Input bind:value={newUserId} placeholder="Yourself" />
			</label>

			<div class="grid grid-cols-2 gap-3">
				<div class="flex flex-col gap-2 text-sm font-medium">
					End date
					<DatePicker bind:value={newDate} label="End date" placeholder="Pick a date" min={today} />
				</div>

				<div class="flex flex-col gap-2 text-sm font-medium">
					End time
					<TimePicker bind:value={newTime} />
				</div>
			</div>

			<label class="flex flex-col gap-2 text-sm font-medium">
				Reason
				<Input bind:value={newReason} placeholder="Away for exams" />
			</label>

			<div class="mt-2 flex gap-2">
				<button
					type="button"
					onclick={resetCreate}
					class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={running === 'create' || !newDate || !newReason.trim()}
					class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{running === 'create' ? 'Creating...' : 'Create'}
				</button>
			</div>
		</form>
	</div>
{/if}

{#if denying}
	{@const target = denying}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (denying = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-md max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="deny-loa-title"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 id="deny-loa-title" class="text-lg font-semibold">Deny this request?</h2>
		<p class="mt-2 text-sm text-muted">
			{name(target)} is told why, so keep it clear.
		</p>

		<form
			method="POST"
			action="?/deny"
			use:enhance={() => control(target.id, 'Leave request denied.', () => (denying = null))}
			class="mt-5 flex flex-col gap-4"
		>
			<input type="hidden" name="loaId" value={target.id} />
			<input type="hidden" name="reason" value={denyReason} />

			<label class="flex flex-col gap-2 text-sm font-medium">
				Reason
				<Input bind:value={denyReason} placeholder="Cover is already thin that week" />
			</label>

			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => (denying = null)}
					class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={running === target.id || !denyReason.trim()}
					class="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{running === target.id ? 'Denying...' : 'Deny'}
				</button>
			</div>
		</form>
	</div>
{/if}

{#if removing}
	{@const target = removing}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (removing = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-md max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-loa-title"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 id="delete-loa-title" class="text-lg font-semibold">Delete this leave?</h2>
		<p class="mt-2 text-sm text-muted">
			The leave filed by {name(target)} is removed from your records. The message posted in Discord is
			left alone. This cannot be undone.
		</p>

		<form
			method="POST"
			action="?/remove"
			use:enhance={() => control(target.id, 'Leave deleted.', () => (removing = null))}
			class="mt-6 flex gap-2"
		>
			<input type="hidden" name="loaId" value={target.id} />
			<button
				type="button"
				onclick={() => (removing = null)}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={running === target.id}
				class="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				{running === target.id ? 'Deleting...' : 'Delete'}
			</button>
		</form>
	</div>
{/if}

{#if viewing}
	{@const target = viewing}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (viewing = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 flex max-h-[80vh] w-lg max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="loa-history-title"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 id="loa-history-title" class="text-lg font-semibold">Leave history</h2>
		<p class="mt-2 text-sm text-muted">Every leave {name(target)} has filed in this server.</p>

		<div class="mt-5 min-h-0 flex-1 divide-y divide-line overflow-y-auto">
			{#each history as record (record.id)}
				{@const state_ = status(record)}
				<div class="py-3">
					<p class="flex items-center justify-between gap-2 text-sm font-medium">
						{record.startedAt ? exactTime(record.startedAt) : 'Unknown start'}
						<span class="text-xs font-normal {state_.tone}">{state_.label}</span>
					</p>
					<p class="mt-1 text-xs text-muted">
						{finished(record) ? 'Ended' : 'Ends'}
						{relativeTime(record.expiry)} &middot; {exactTime(record.expiry)}
					</p>
					<p class="mt-2 text-sm">{record.reason}</p>
				</div>
			{/each}
		</div>

		<button
			type="button"
			onclick={() => (viewing = null)}
			class="mt-6 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
		>
			Close
		</button>
	</div>
{/if}
