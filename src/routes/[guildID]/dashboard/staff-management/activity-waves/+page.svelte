<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Search from '@lucide/svelte/icons/search';
	import Waves from '@lucide/svelte/icons/waves';
	import X from '@lucide/svelte/icons/x';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { guildData } from '$lib/dashboardData.svelte';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import Duration from '$lib/components/settings/Duration.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import type { WavePreview } from '$lib/server/staff';
	import { duration, exactTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const typeOptions = $derived(data.types.map((type) => ({ value: type, label: type })));

	let infractionType = $state('');
	let period = $state(0);
	let omitLoas = $state(true);

	let preview = $state<WavePreview | null>(null);
	let previewing = $state(false);
	let running = $state(false);
	let reviewing = $state(false);
	let reason = $state('');
	let search = $state('');
	let rankFilter = $state('');
	const excluded = new SvelteSet<string>();

	const rankOrder = ['Moderator', 'Administrator', 'Management'];

	let issuing = $state(false);
	let finished = $state(false);
	let done = $state(0);
	let total = $state(0);
	let status = $state<Record<string, 'pending' | 'ok' | 'fail'>>({});
	let messages = $state<Record<string, string>>({});

	const ready = $derived(infractionType.trim().length >= 2);
	const violators = $derived(
		preview?.users.filter((user) => !user.metQuota && !user.skippedLoa) ?? []
	);
	const targets = $derived(violators.filter((user) => !excluded.has(user.userId)));
	const ranks = $derived(rankOrder.filter((rank) => violators.some((user) => user.rank === rank)));
	const rankOptions = $derived([
		{ value: '', label: 'All ranks' },
		...ranks.map((rank) => ({ value: rank, label: rank }))
	]);
	const shown = $derived(
		violators.filter(
			(user) =>
				user.username.toLowerCase().includes(search.trim().toLowerCase()) &&
				(!rankFilter || user.rank === rankFilter)
		)
	);
	const useBulk = $derived(targets.length === violators.length && reason.trim().length === 0);
	const locked = $derived(issuing || finished);
	const percent = $derived(total ? Math.round((done / total) * 100) : 0);
	const okCount = $derived(Object.values(status).filter((state) => state === 'ok').length);
	const failCount = $derived(Object.values(status).filter((state) => state === 'fail').length);

	function toggle(userId: string) {
		if (excluded.has(userId)) excluded.delete(userId);
		else excluded.add(userId);
	}

	function closeReview() {
		if (issuing) return;

		reviewing = false;
		search = '';
		rankFilter = '';
		if (finished) {
			preview = null;
			excluded.clear();
			reason = '';
		}
		finished = false;
		status = {};
		messages = {};
		done = 0;
		total = 0;
	}

	async function runIndividual() {
		const list = targets.map((user) => ({ userId: user.userId, username: user.username }));
		if (!list.length) return;

		issuing = true;
		finished = false;
		total = list.length;
		done = 0;
		status = Object.fromEntries(list.map((item) => [item.userId, 'pending' as const]));
		messages = {};

		const endpoint = `/${data.guild.id}/dashboard/staff-management/activity-waves/issue`;

		for (const item of list) {
			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						userId: item.userId,
						username: item.username,
						reason,
						infractionType
					})
				});

				const result = (await response.json().catch(() => ({ ok: false }))) as {
					ok?: boolean;
					message?: string;
				};

				status[item.userId] = result.ok ? 'ok' : 'fail';
				if (!result.ok && result.message) messages[item.userId] = result.message;
			} catch {
				status[item.userId] = 'fail';
			}

			done += 1;
		}

		issuing = false;
		finished = true;

		const failed = list.filter((item) => status[item.userId] === 'fail').length;
		if (failed) {
			toast(`Issued ${list.length - failed} of ${list.length}, ${failed} failed.`, 'error');
		} else {
			toast('Activity wave complete.', 'success');
		}
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && reviewing && closeReview()} />

<svelte:head><title>Activity Waves - {guildData.name}</title></svelte:head>

<Card title="Run a wave" description="Check who is behind on quota, then infract them in one pass.">
	{#snippet action()}
		<button
			type="submit"
			form="wave-config"
			disabled={previewing || !ready}
			class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
		>
			{previewing ? 'Previewing...' : 'Preview wave'}
		</button>
	{/snippet}

	<form
		id="wave-config"
		method="POST"
		action="?/preview"
		use:enhance={() => {
			previewing = true;

			return async ({ result }) => {
				previewing = false;

				if (result.type === 'failure') {
					toast(String(result.data?.message ?? 'Could not preview that wave.'), 'error');
					return;
				}

				preview = (result as { data?: { preview?: WavePreview } }).data?.preview ?? null;
				excluded.clear();
				reason = '';
				search = '';
				rankFilter = '';
				reviewing = !!preview;
			};
		}}
	>
		<input type="hidden" name="period" value={period} />

		<div class="grid gap-5 px-6 py-5 sm:grid-cols-2">
			<Field label="Infraction type" description="The type issued to everyone below quota.">
				<input type="hidden" name="infractionType" value={infractionType} />
				{#if typeOptions.length}
					<Select options={typeOptions} bind:value={infractionType} placeholder="Pick a type" />
				{:else}
					<div
						class="flex min-h-10 w-full cursor-not-allowed items-center rounded-lg border border-line bg-white/5 px-3 py-2 text-sm text-muted opacity-60"
					>
						No infraction types found
					</div>
				{/if}
			</Field>

			<Field label="Period" description="Leave at zero to use your usual quota period.">
				<Duration bind:seconds={period} units={['days']} />
			</Field>

			<Field
				label="Omit members on LOA"
				description="Skip anyone with an approved leave of absence."
			>
				<Switch bind:checked={omitLoas} name="omitLoas" label="Omit members on LOA" />
			</Field>
		</div>
	</form>

	<Callout tone="warning">
		A wave issues an infraction to every staff member you leave selected below quota, all at once.
		Read the preview before running it.
	</Callout>
</Card>

{#if reviewing && preview}
	<div
		class="fixed inset-0 z-80 bg-black/70 backdrop-blur-sm"
		role="presentation"
		onclick={closeReview}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed inset-0 z-90 flex justify-center p-4 sm:p-6"
		transition:fly={{ y: 12, duration: 160 }}
	>
		<form
			method="POST"
			action="?/start"
			class="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
			use:enhance={() => {
				running = true;

				return async ({ result }) => {
					running = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not start that wave.'), 'error');
						return;
					}

					toast('Activity wave started.', 'success');
					reviewing = false;
					preview = null;
					reason = '';
					excluded.clear();
				};
			}}
		>
			<input type="hidden" name="infractionType" value={infractionType} />
			<input type="hidden" name="period" value={period} />
			{#if omitLoas}
				<input type="hidden" name="omitLoas" value="on" />
			{/if}

			<div class="flex items-start gap-4 border-b border-line px-6 py-5">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/8">
					<Waves class="h-5 w-5" />
				</div>

				<div class="min-w-0 flex-1">
					<h2 class="font-semibold">Review this wave</h2>
					<p class="mt-1 text-sm text-muted">
						{#if preview.periodStart && preview.periodEnd}
							Covering {exactTime(preview.periodStart)} to {exactTime(preview.periodEnd)}.
						{:else}
							Pick who gets infracted, then run the wave.
						{/if}
					</p>
				</div>

				<button
					type="button"
					onclick={closeReview}
					disabled={issuing}
					aria-label="Close"
					class="-mt-1 -mr-2 rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<dl class="grid gap-px border-b border-line bg-line sm:grid-cols-4">
				{#each [{ label: 'Staff checked', value: preview.totalUsers }, { label: 'Below quota', value: preview.belowQuota }, { label: 'Above quota', value: preview.aboveQuota }, { label: 'Skipped for LOA', value: preview.skippedLoa }] as stat (stat.label)}
					<div class="bg-surface px-6 py-4">
						<dt class="text-sm text-muted">{stat.label}</dt>
						<dd class="mt-1 text-2xl font-semibold">{stat.value}</dd>
					</div>
				{/each}
			</dl>

			<div class="min-h-0 flex-1 overflow-y-auto">
				<div
					class="border-b border-line px-6 py-5 transition-opacity {locked ? 'opacity-60' : ''}"
					inert={locked}
				>
					<Field
						label="Reason"
						description="Shared across everyone infracted. Leave blank to use the default wave reason."
					>
						<Input
							bind:value={reason}
							maxlength={500}
							placeholder="Missed quota during an activity wave."
						/>
					</Field>
				</div>

				{#if !violators.length}
					<p class="px-6 py-10 text-center text-sm text-muted">
						Nobody is below quota for this period, so there is nothing to infract.
					</p>
				{:else}
					<div
						class="flex flex-col gap-3 border-b border-line px-6 py-3 sm:flex-row sm:items-center"
					>
						<div
							class="flex flex-1 items-center gap-2 rounded-lg border border-line bg-white/5 px-3"
						>
							<Search class="h-4 w-4 shrink-0 text-muted" />
							<input
								type="text"
								bind:value={search}
								placeholder="Search members"
								class="w-full border-0 bg-transparent py-2 text-sm placeholder:text-muted focus:ring-0 focus:outline-none"
							/>
						</div>

						{#if ranks.length}
							<div class="sm:w-48">
								<Select options={rankOptions} bind:value={rankFilter} placeholder="All ranks" />
							</div>
						{/if}
					</div>

					{#if !shown.length}
						<p class="px-6 py-10 text-center text-sm text-muted">No members match your search.</p>
					{:else}
						<ul class="divide-y divide-line">
							{#each shown as user (user.userId)}
								{@const skip = excluded.has(user.userId)}
								{@const state = status[user.userId]}
								<li>
									{#if issuing || finished}
										<div class="flex items-center gap-3 px-6 py-3">
											<span class="flex h-4 w-4 shrink-0 items-center justify-center">
												{#if state === 'ok'}
													<Check class="h-4 w-4 text-emerald-400" />
												{:else if state === 'fail'}
													<X class="h-4 w-4 text-red-400" />
												{:else if state === 'pending'}
													<LoaderCircle class="h-4 w-4 animate-spin text-muted" />
												{/if}
											</span>

											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-medium {state ? '' : 'text-muted'}">
													{user.username}
												</p>
												<p class="truncate text-xs text-muted">
													{#if state === 'fail' && messages[user.userId]}
														{messages[user.userId]}
													{:else}
														{duration(user.shiftTime)} logged of {duration(user.requiredQuota)} quota
													{/if}
												</p>
											</div>

											<span
												class="shrink-0 text-xs font-medium {state === 'ok'
													? 'text-emerald-400'
													: state === 'fail'
														? 'text-red-400'
														: 'text-muted'}"
											>
												{#if state === 'ok'}
													Issued
												{:else if state === 'fail'}
													Failed
												{:else if state === 'pending'}
													Issuing...
												{:else}
													Skipped
												{/if}
											</span>
										</div>
									{:else}
										<label
											class="flex cursor-pointer items-center gap-3 px-6 py-3 transition-colors hover:bg-white/5"
										>
											<input
												type="checkbox"
												checked={!skip}
												onchange={() => toggle(user.userId)}
												class="h-4 w-4 shrink-0 rounded border-line bg-white/5 accent-white"
											/>

											<div class="min-w-0 flex-1">
												<p
													class="truncate text-sm font-medium {skip
														? 'text-muted line-through'
														: ''}"
												>
													{user.username}
												</p>
												<p class="text-xs text-muted">
													{duration(user.shiftTime)} logged of {duration(user.requiredQuota)} quota
												</p>
											</div>

											<span
												class="shrink-0 text-xs font-medium {skip ? 'text-muted' : 'text-red-400'}"
											>
												{skip ? 'Skipped' : 'Will infract'}
											</span>
										</label>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</div>

			{#if running || issuing || finished}
				<div class="h-1 w-full overflow-hidden bg-white/10">
					{#if running}
						<div class="h-full w-full animate-pulse bg-white/70"></div>
					{:else}
						<div
							class="h-full bg-white transition-[width] duration-200"
							style="width: {finished ? 100 : percent}%"
						></div>
					{/if}
				</div>
			{/if}

			<div class="flex items-center gap-3 border-t border-line px-6 py-4">
				{#if issuing}
					<p class="min-w-0 flex-1 text-sm text-muted">Issuing {done} of {total}...</p>
					<button
						type="button"
						disabled
						class="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg opacity-60 pointer-coarse:py-3"
					>
						Running...
					</button>
				{:else if finished}
					<p class="min-w-0 flex-1 text-sm text-muted">
						{okCount} issued{failCount ? `, ${failCount} failed` : ''}.
					</p>
					<button
						type="button"
						onclick={closeReview}
						class="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
					>
						Done
					</button>
				{:else}
					<p class="min-w-0 flex-1 text-sm text-muted">
						{targets.length} of {violators.length} selected
					</p>

					<button
						type="button"
						onclick={closeReview}
						disabled={running}
						class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
					>
						Cancel
					</button>

					{#if useBulk}
						<button
							type="submit"
							disabled={running || !targets.length}
							class="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
						>
							{running ? 'Running...' : `Run wave (${targets.length})`}
						</button>
					{:else}
						<button
							type="button"
							onclick={runIndividual}
							disabled={!targets.length}
							class="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
						>
							Run wave ({targets.length})
						</button>
					{/if}
				{/if}
			</div>
		</form>
	</div>
{/if}
