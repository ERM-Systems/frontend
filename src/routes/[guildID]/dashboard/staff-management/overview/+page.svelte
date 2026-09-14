<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import Search from '@lucide/svelte/icons/search';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Plus from '@lucide/svelte/icons/plus';
	import Archive from '@lucide/svelte/icons/archive';
	import IdCard from '@lucide/svelte/icons/id-card';
	import { fade } from 'svelte/transition';
	import { navigating } from '$app/state';
	import { managementLevel } from '$lib/dashboard';
	import { guildData } from '$lib/dashboardData.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Pager from '$lib/components/Pager.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import UserDetailsDialog from '$lib/components/UserDetailsDialog.svelte';
	import Callout from '$lib/components/settings/Callout.svelte';
	import CreateShift from './CreateShift.svelte';
	import Snapshots from './Snapshots.svelte';
	import { defaultAvatar, duration, exactTime, relativeTime } from '$lib/staff';
	import type { ResolvedPathname } from '$app/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const periodHref = (value: string) =>
		`/${data.guild.id}/dashboard/staff-management/overview?period=${value}${
			data.code ? `&code=${data.code}` : ''
		}` as ResolvedPathname;

	const liveHref = $derived(
		`/${data.guild.id}/dashboard/staff-management/overview?period=${data.period}` as ResolvedPathname
	);

	const memberHref = (userId: string) =>
		`/${data.guild.id}/dashboard/staff-management/overview/${userId}` as ResolvedPathname;

	const options = [
		{ value: '7', label: 'Last 7 days' },
		{ value: '14', label: 'Last 14 days' },
		{ value: '30', label: 'Last 30 days' },
		{ value: 'all', label: 'All time' }
	];

	const duties = [
		{ value: '', label: 'All staff' },
		{ value: 'on', label: 'On duty' },
		{ value: 'off', label: 'Off duty' }
	];

	const quotas = [
		{ value: '', label: 'Any quota' },
		{ value: 'met', label: 'Met quota' },
		{ value: 'missed', label: 'Missed quota' }
	];

	let query = $state('');
	let duty = $state('');
	let quota = $state('');
	let creatingShift = $state(false);
	let viewingSnapshots = $state(false);
	let details = $state<(typeof staff)[number] | null>(null);

	const privileged = $derived(guildData.level >= managementLevel);

	const staff = $derived(data.staff ?? []);

	let lateAvatars = $state<Record<string, string>>({});

	$effect(() => {
		const incoming = data.avatars;
		let active = true;

		incoming.then((value) => active && (lateAvatars = value));

		return () => {
			active = false;
		};
	});

	const filtered = $derived.by(() => {
		const term = query.trim().toLowerCase();

		return staff.filter((member) => {
			if (duty && member.onDuty !== (duty === 'on')) return false;
			if (quota && data.quota && member.total >= data.quota !== (quota === 'met')) return false;
			if (!term) return true;

			return [member.username, member.nickname].some((field) => field.toLowerCase().includes(term));
		});
	});

	const columns = [
		{ key: 'shifts' as const, label: 'Shifts', compact: false },
		{ key: 'total' as const, label: 'On duty', compact: true },
		{ key: 'lastShift' as const, label: 'Last shift', compact: false }
	];

	let sort = $state<'shifts' | 'total' | 'lastShift'>('total');
	let descending = $state(true);

	function order(key: 'shifts' | 'total' | 'lastShift') {
		if (sort === key) {
			descending = !descending;
			return;
		}

		sort = key;
		descending = true;
	}

	const sorted = $derived.by(() => {
		const direction = descending ? -1 : 1;
		return [...filtered].sort((a, b) => (a[sort] - b[sort]) * direction);
	});

	const totals = $derived({
		hours: staff.reduce((sum, member) => sum + member.total, 0),
		met: data.quota ? staff.filter((member) => member.total >= data.quota).length : 0
	});

	const loading = $derived(!!navigating.to);

	const perPage = 10;

	let page = $state(1);

	const pages = $derived(Math.max(1, Math.ceil(filtered.length / perPage)));
	const current = $derived(Math.min(page, pages));
	const shown = $derived(sorted.slice((current - 1) * perPage, current * perPage));

	let signature = $state('');

	$effect(() => {
		const next = `${query}:${duty}:${quota}:${data.period}`;
		if (next === signature) return;

		signature = next;
		page = 1;
	});
</script>

<svelte:head><title>Staff Overview - {guildData.name}</title></svelte:head>

<Card
	title="Staff overview"
	description="On-duty time per staff member, built from every shift recorded in the period."
>
	{#snippet action()}
		<div class="flex flex-wrap items-center gap-2">
			<div
				class="no-scrollbar flex min-w-0 gap-1 overflow-x-auto rounded-lg border border-line bg-white/5 p-1"
			>
				{#each options as option (option.value)}
					<a
						href={periodHref(option.value)}
						data-sveltekit-noscroll
						aria-current={data.period === option.value ? 'page' : undefined}
						class="shrink-0 rounded-md px-3 py-1.5 text-xs transition-colors pointer-coarse:py-3.5 {data.period ===
						option.value
							? 'bg-white/10 font-medium text-white'
							: 'text-muted hover:text-white'}"
					>
						{option.label}
					</a>
				{/each}
			</div>

			{#if privileged}
				<button
					type="button"
					onclick={() => (viewingSnapshots = true)}
					class="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
				>
					<Archive class="h-4 w-4" />
					Snapshots
				</button>

				<button
					type="button"
					onclick={() => (creatingShift = true)}
					class="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
				>
					<Plus class="h-4 w-4" />
					Create shift
				</button>
			{/if}
		</div>
	{/snippet}

	{#if data.code}
		<Callout tone="warning">
			You are reading snapshot <span class="font-mono">{data.code}</span>, not live shifts.
			<a href={liveHref} class="text-white underline underline-offset-2">Back to live data</a>.
		</Callout>
	{/if}

	<div class="relative">
		{#if loading}
			<div
				class="absolute inset-0 z-10 flex items-start justify-center pt-10"
				transition:fade={{ duration: 120 }}
			>
				<span
					class="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-muted shadow-2xl shadow-black/60"
				>
					<LoaderCircle class="h-4 w-4 animate-spin" />
					Loading shifts
				</span>
			</div>
		{/if}

		<div class="{loading ? 'pointer-events-none blur-[3px] select-none' : ''} transition">
			{#if !data.staff}
				<p class="px-6 py-10 text-center text-sm text-muted">
					Your shift history is unavailable right now. Reload in a moment.
				</p>
			{:else if !staff.length}
				<p class="px-6 py-10 text-center text-sm text-muted">No shifts recorded in this period.</p>
			{:else}
				<dl class="grid gap-px border-b border-line bg-line sm:grid-cols-3">
					<div class="bg-surface px-6 py-4">
						<dt class="text-sm text-muted">Staff active</dt>
						<dd class="mt-1 text-2xl font-semibold">{staff.length}</dd>
					</div>

					<div class="bg-surface px-6 py-4">
						<dt class="text-sm text-muted">Time on duty</dt>
						<dd class="mt-1 text-2xl font-semibold">{duration(totals.hours)}</dd>
					</div>

					<div class="bg-surface px-6 py-4">
						<dt class="text-sm text-muted">Met quota</dt>
						<dd class="mt-1 text-2xl font-semibold">
							{#if data.quota}
								{totals.met} of {staff.length}
							{:else}
								No quota set
							{/if}
						</dd>
					</div>
				</dl>

				<div class="flex flex-col gap-3 border-b border-line px-6 py-4 sm:flex-row">
					<div class="flex flex-1 items-center gap-2 rounded-lg border border-line bg-white/5 px-3">
						<Search class="h-4 w-4 shrink-0 text-muted" />
						<input
							bind:value={query}
							placeholder="Search staff"
							aria-label="Search staff"
							class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
						/>
					</div>

					<div class="sm:w-44">
						<Select options={duties} bind:value={duty} placeholder="All staff" />
					</div>

					{#if data.quota}
						<div class="sm:w-44">
							<Select options={quotas} bind:value={quota} placeholder="Any quota" />
						</div>
					{/if}
				</div>

				{#if !filtered.length}
					<p class="px-6 py-10 text-center text-sm text-muted">No staff match that search.</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-left text-sm md:min-w-160">
							<thead class="text-xs tracking-wide text-muted uppercase">
								<tr class="border-b border-line">
									<th scope="col" class="px-4 py-3 font-medium md:px-6">Staff member</th>

									{#each columns as column (column.key)}
										<th
											scope="col"
											class="font-medium {column.compact ? '' : 'hidden md:table-cell'}"
										>
											<button
												type="button"
												onclick={() => order(column.key)}
												aria-label="Sort by {column.label}"
												class="flex w-full items-center gap-1 px-4 py-3 tracking-wide whitespace-nowrap uppercase transition-colors hover:text-white md:px-6 pointer-coarse:py-3.5 {sort ===
												column.key
													? 'text-white'
													: ''}"
											>
												{column.label}
												{#if sort === column.key}
													<ChevronDown
														class="h-3 w-3 {descending ? '' : 'rotate-180'} transition-transform"
													/>
												{:else}
													<ChevronsUpDown class="h-3 w-3 opacity-40" />
												{/if}
											</button>
										</th>

										{#if column.key === 'total'}
											<th scope="col" class="hidden px-4 py-3 font-medium md:table-cell md:px-6"
												>Quota</th
											>
										{/if}
									{/each}

									<th scope="col" class="px-4 py-3 font-medium md:px-6">
										<span class="sr-only">Details</span>
									</th>
								</tr>
							</thead>

							<tbody class="divide-y divide-line">
								{#each shown as member (member.userId)}
									{@const name = member.nickname || member.username || 'Unknown member'}
									<tr class="relative transition-colors hover:bg-white/3">
										<td class="px-4 py-3 md:px-6">
											<div class="flex items-center gap-3">
												<img
													src={member.avatarUrl ||
														lateAvatars[member.userId] ||
														defaultAvatar(member.userId)}
													alt=""
													loading="lazy"
													onerror={(event) => {
														const image = event.currentTarget as HTMLImageElement;
														const fallback = defaultAvatar(member.userId);
														if (image.src !== fallback) image.src = fallback;
													}}
													class="h-7 w-7 shrink-0 rounded-lg bg-white/8 object-cover sm:h-8 sm:w-8"
												/>

												<div class="min-w-0">
													<a
														href={memberHref(member.userId)}
														aria-label="Open {name}"
														class="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
													></a>
													<p class="truncate font-medium">{name}</p>
													{#if member.onDuty}
														<p class="flex items-center gap-1.5 text-xs text-green-500">
															<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
															On duty now
														</p>
													{:else if member.moderations}
														<p class="text-xs text-muted">{member.moderations} moderations</p>
													{/if}
													<p class="truncate text-xs text-muted md:hidden">
														{member.shifts} shift{member.shifts === 1 ? '' : 's'} &middot; last {relativeTime(
															member.lastShift
														)}
													</p>
												</div>
											</div>
										</td>

										<td class="hidden px-4 py-3 text-muted md:table-cell md:px-6"
											>{member.shifts}</td
										>
										<td class="px-4 py-3 md:px-6">{duration(member.total)}</td>

										<td class="hidden px-4 py-3 md:table-cell md:px-6">
											{#if !data.quota}
												<span class="text-muted">No quota</span>
											{:else if member.total >= data.quota}
												<span
													class="rounded-md border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500"
												>
													Met
												</span>
											{:else}
												<span
													class="rounded-md border border-yellow-400/25 bg-yellow-400/10 px-2 py-0.5 text-xs font-medium text-yellow-400"
												>
													Missed
												</span>
											{/if}
										</td>

										<td class="hidden px-4 py-3 text-muted md:table-cell md:px-6">
											<Tooltip text={exactTime(member.lastShift)}>
												{relativeTime(member.lastShift)}
											</Tooltip>
										</td>

										<td class="relative z-10 w-px px-4 py-3 text-right md:px-6">
											<Tooltip text="Member details">
												<button
													type="button"
													onclick={() => (details = member)}
													aria-label="Show details for {name}"
													class="tap inline-flex items-center rounded-md border border-line bg-white/5 p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
												>
													<IdCard class="h-3.5 w-3.5" />
												</button>
											</Tooltip>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<Pager total={sorted.length} {perPage} bind:page label="staff" />
				{/if}
			{/if}
		</div>
	</div>
</Card>

<CreateShift bind:open={creatingShift} guildId={data.guild.id} types={data.types} />
<Snapshots
	bind:open={viewingSnapshots}
	guildId={data.guild.id}
	period={data.period}
	codes={data.codes}
/>
<UserDetailsDialog bind:member={details} guildId={data.guild.id} />
