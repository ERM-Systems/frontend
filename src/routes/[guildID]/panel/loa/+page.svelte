<script lang="ts">
	import CalendarOff from '@lucide/svelte/icons/calendar-off';
	import History from '@lucide/svelte/icons/history';
	import Timer from '@lucide/svelte/icons/timer';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Pager from '$lib/components/Pager.svelte';
	import DatePicker, { isoDate } from '$lib/components/settings/DatePicker.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import TimePicker from '$lib/components/settings/TimePicker.svelte';
	import { exactTime, pageSlice, relativeTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { LoaRecord } from '$lib/server/loa';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const now = Math.floor(Date.now() / 1000);
	const perPage = 5;

	const today = isoDate();

	let page = $state(1);
	let running = $state('');

	let newDate = $state('');
	let newTime = $state('12:00');
	let newReason = $state('');

	function finished(record: LoaRecord): boolean {
		return record.expired || record.expiry <= now;
	}

	const current = $derived(data.loas.find((record) => !record.denied && !finished(record)) ?? null);
	const history = $derived(data.loas.filter((record) => record.id !== current?.id));
	const shown = $derived(pageSlice(history, page, perPage));

	const expiry = $derived(
		newDate ? Math.floor(new Date(`${newDate}T${newTime}`).getTime() / 1000) : 0
	);

	function status(record: LoaRecord): { label: string; tone: string } {
		if (record.denied) return { label: 'Denied', tone: 'text-red-400' };
		if (finished(record)) return { label: 'Ended', tone: 'text-muted' };
		if (record.accepted) return { label: 'Active', tone: 'text-green-500' };

		return { label: 'Pending', tone: 'text-yellow-400' };
	}

	function canEnd(record: LoaRecord): boolean {
		return record.accepted && !record.denied && !finished(record);
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
</script>

<svelte:head><title>Your Leave - {data.guild.name}</title></svelte:head>

<section class="mx-auto max-w-3xl px-6 py-16">
	<div class="flex items-center gap-4">
		{#if data.guild.iconUrl}
			<img src={data.guild.iconUrl} alt="" class="h-12 w-12 shrink-0 rounded-xl object-cover" />
		{:else}
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-line text-sm font-semibold"
			>
				{data.guild.name.slice(0, 2).toUpperCase()}
			</div>
		{/if}

		<div class="min-w-0">
			<p class="truncate text-xs text-muted">{data.guild.name}</p>
			<h1 class="mt-0.5 text-2xl font-bold tracking-[-0.02em]">Leave of Absence</h1>
		</div>
	</div>

	<p class="mt-3 text-muted">
		File your time away from duties and keep the rest of the team in the loop.
	</p>

	<div class="mt-8 rounded-xl border border-line bg-surface">
		<div class="flex items-center gap-2 border-b border-line px-6 py-4">
			<Timer class="h-4 w-4 text-muted" />
			<h2 class="text-sm font-semibold">{current ? 'Your leave' : 'Request leave'}</h2>
			{#if current}
				{@const state_ = status(current)}
				<span class="ml-auto text-xs {state_.tone}">{state_.label}</span>
			{/if}
		</div>

		{#if current}
			<div class="px-6 py-5">
				<p class="text-sm whitespace-pre-wrap">{current.reason}</p>
				<p class="mt-2 text-xs text-muted">
					Ends {relativeTime(current.expiry)} &middot; {exactTime(current.expiry)}
				</p>

				{#if canEnd(current)}
					<form
						method="POST"
						action="?/end"
						use:enhance={() => control(current.id, 'Leave ended.')}
						class="mt-5"
					>
						<input type="hidden" name="loaId" value={current.id} />
						<button
							type="submit"
							disabled={running !== ''}
							class="flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
						>
							<CalendarOff class="h-4 w-4" />
							{running === current.id ? 'Ending...' : 'End early'}
						</button>
					</form>
				{:else}
					<p class="mt-5 text-xs text-muted">
						Your request is waiting on a decision from the staff team.
					</p>
				{/if}
			</div>
		{:else}
			<form
				method="POST"
				action="?/create"
				use:enhance={() =>
					control('create', 'Leave request submitted.', () => {
						newDate = '';
						newTime = '12:00';
						newReason = '';
					})}
				class="flex flex-col gap-4 px-6 py-5"
			>
				<input type="hidden" name="expiry" value={expiry} />
				<input type="hidden" name="reason" value={newReason} />

				<div class="grid grid-cols-2 gap-3">
					<div class="flex flex-col gap-2 text-sm font-medium">
						End date
						<DatePicker
							bind:value={newDate}
							label="End date"
							placeholder="Pick a date"
							min={today}
						/>
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

				<button
					type="submit"
					disabled={running === 'create' || !newDate || !newReason.trim()}
					class="mt-1 self-start rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{running === 'create' ? 'Submitting...' : 'Submit request'}
				</button>
			</form>
		{/if}
	</div>

	<div class="mt-6 rounded-xl border border-line bg-surface">
		<div class="flex items-center gap-2 border-b border-line px-6 py-4">
			<History class="h-4 w-4 text-muted" />
			<h2 class="text-sm font-semibold">History</h2>
			{#if history.length}
				<span class="ml-auto text-xs text-muted">
					{history.length}
					{history.length === 1 ? 'request' : 'requests'}
				</span>
			{/if}
		</div>

		{#if !history.length}
			<p class="px-6 py-10 text-center text-sm text-muted">
				You have not filed any leave in this server yet.
			</p>
		{:else}
			<ul class="divide-y divide-line">
				{#each shown as record (record.id)}
					{@const state_ = status(record)}
					<li class="px-6 py-4">
						<div class="flex items-center gap-2">
							<span class="text-xs font-medium {state_.tone}">{state_.label}</span>
							<span class="ml-auto shrink-0 text-xs text-muted">{exactTime(record.expiry)}</span>
						</div>

						<p class="mt-2 text-sm whitespace-pre-wrap">{record.reason}</p>
					</li>
				{/each}
			</ul>

			<Pager total={history.length} {perPage} bind:page label="requests" />
		{/if}
	</div>
</section>
