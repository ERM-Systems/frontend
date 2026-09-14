<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CalendarOff from '@lucide/svelte/icons/calendar-off';
	import Coffee from '@lucide/svelte/icons/coffee';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { guildData } from '$lib/dashboardData.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Pager from '$lib/components/Pager.svelte';
	import InfractionEditor from '$lib/components/InfractionEditor.svelte';
	import InfractionDelete from '$lib/components/InfractionDelete.svelte';
	import InfractionRevoke from '$lib/components/InfractionRevoke.svelte';
	import InfractionVisualizer from '$lib/components/InfractionVisualizer.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import InfractionCreate from '../../InfractionCreate.svelte';
	import ManageShift from './ManageShift.svelte';
	import { defaultAvatar, duration, exactTime, pageSlice, relativeTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { ResolvedPathname } from '$app/types';
	import type { Infraction, ShiftRecord } from '$lib/server/staff';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const back = $derived(
		`/${data.guild.id}/dashboard/staff-management/overview` as ResolvedPathname
	);

	const loa = $derived(`/${data.guild.id}/dashboard/loa` as ResolvedPathname);

	const member = $derived(data.member);
	const name = $derived(member.username || 'Unknown member');

	const perPage = 10;

	let creating = $state(false);
	let managing = $state<ShiftRecord | null>(null);
	let editing = $state<Infraction | null>(null);
	let deleting = $state<Infraction | null>(null);
	let revoking = $state<Infraction | null>(null);
	let starting = $state(false);
	let breaking = $state(false);
	let startType = $state('');
	let shiftPage = $state(1);
	let punishmentPage = $state(1);
	let logPage = $state(1);
	let infractionPage = $state(1);

	const target = $derived({
		userId: data.userId,
		username: member.username,
		displayName: member.displayName || member.username,
		avatarUrl: member.avatarUrl
	});

	const startOptions = $derived(
		(data.shiftTypes.length ? data.shiftTypes : ['Default']).map((value) => ({
			value,
			label: value
		}))
	);

	const active = $derived(data.shifts?.find((shift) => !shift.end) ?? null);
	const onBreak = $derived(
		!!active?.breaks.length && active.breaks[active.breaks.length - 1].end === 0
	);

	const shifts = $derived(pageSlice(data.shifts ?? [], shiftPage, perPage));
	const punishments = $derived(pageSlice(data.punishments ?? [], punishmentPage, perPage));
	const logs = $derived(pageSlice(data.logs ?? [], logPage, perPage));
	const infractions = $derived(pageSlice(data.infractions ?? [], infractionPage, perPage));
</script>

<svelte:head><title>{name} - {guildData.name}</title></svelte:head>

<a
	href={back}
	class="flex w-fit items-center gap-2 text-sm text-muted transition-colors hover:text-white"
>
	<ArrowLeft class="h-4 w-4" />
	Back to staff overview
</a>

<Card title="Discord Information" description="Who this member is inside your server.">
	{#snippet action()}
		<div class="flex flex-wrap items-center gap-2">
			<a
				href={loa}
				class="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				<CalendarOff class="h-4 w-4" />
				LOA records
			</a>

			<button
				type="button"
				onclick={() => (creating = true)}
				class="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Issue infraction
			</button>
		</div>
	{/snippet}

	<div class="flex flex-wrap items-center gap-4 border-b border-line px-6 py-5">
		<img
			src={member.avatarUrl || defaultAvatar(data.userId)}
			alt=""
			onerror={(event) => {
				const image = event.currentTarget as HTMLImageElement;
				const fallback = defaultAvatar(data.userId);
				if (image.src !== fallback) image.src = fallback;
			}}
			class="h-14 w-14 shrink-0 rounded-xl bg-white/8 object-cover"
		/>

		<div class="min-w-0 flex-1">
			<p class="truncate text-lg font-semibold">{name}</p>
			{#if member.onDuty}
				<p class="flex items-center gap-1.5 text-xs text-green-500">
					<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
					On duty now
				</p>
			{:else}
				<p class="text-xs text-muted">
					{member.shifts} shifts, {duration(member.total)} on duty
				</p>
			{/if}
		</div>

		{#if active}
			<form
				method="POST"
				action="?/toggleBreak"
				use:enhance={() => {
					breaking = true;

					return async ({ result }) => {
						breaking = false;

						if (result.type === 'failure') {
							toast(String(result.data?.message ?? 'Could not toggle that break.'), 'error');
							return;
						}

						await invalidateAll();
						toast(onBreak ? 'Break ended.' : 'Break started.', 'success');
					};
				}}
			>
				<button
					type="submit"
					disabled={breaking}
					class="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					<Coffee class="h-4 w-4" />
					{onBreak ? 'End break' : 'Start break'}
				</button>
			</form>
		{/if}
	</div>

	<div class="grid gap-6 px-6 py-5 sm:grid-cols-2">
		<Field label="Username">
			<p class="text-sm text-muted">{member.username || 'Unknown'}</p>
		</Field>

		<Field label="Discord ID">
			<p class="font-mono text-sm text-muted">{data.userId}</p>
		</Field>
	</div>
</Card>

<Card title="Shift logs" description="Every shift this member has recorded, newest first.">
	{#snippet action()}
		{#if !active}
			<form
				method="POST"
				action="?/startShift"
				use:enhance={() => {
					starting = true;

					return async ({ result }) => {
						starting = false;

						if (result.type === 'failure') {
							toast(String(result.data?.message ?? 'Could not start that shift.'), 'error');
							return;
						}

						startType = '';
						await invalidateAll();
						toast('Shift started.', 'success');
					};
				}}
				class="flex flex-wrap items-center gap-2"
			>
				<input type="hidden" name="type" value={startType} />

				<div class="w-44">
					<Select options={startOptions} bind:value={startType} placeholder="Shift type" />
				</div>

				<button
					type="submit"
					disabled={starting || !startType}
					class="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{starting ? 'Starting...' : 'Start shift'}
				</button>
			</form>
		{/if}
	{/snippet}

	{#if !data.shifts}
		<p class="px-6 py-10 text-center text-sm text-muted">
			Their shift history is unavailable right now. Reload in a moment.
		</p>
	{:else if !data.shifts.length}
		<p class="px-6 py-10 text-center text-sm text-muted">No shifts recorded.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm md:min-w-160">
				<thead class="text-xs tracking-wide text-muted uppercase">
					<tr class="border-b border-line">
						<th scope="col" class="px-4 py-3 font-medium md:px-6">Started</th>
						<th scope="col" class="hidden px-4 py-3 font-medium md:table-cell md:px-6">Ended</th>
						<th scope="col" class="px-4 py-3 font-medium md:px-6">Duration</th>
						<th scope="col" class="hidden px-4 py-3 font-medium md:table-cell md:px-6">Type</th>
						<th scope="col" class="hidden px-4 py-3 font-medium md:table-cell md:px-6">Breaks</th>
						<th scope="col" class="px-4 py-3 font-medium md:px-6">
							<span class="sr-only">Manage</span>
						</th>
					</tr>
				</thead>

				<tbody class="divide-y divide-line">
					{#each shifts as shift (shift.id || `${shift.start}-${shift.end}`)}
						<tr>
							<td class="px-4 py-3 md:px-6">
								<Tooltip text={exactTime(shift.start)}>{relativeTime(shift.start)}</Tooltip>
								<span class="mt-1 block text-xs text-muted md:hidden">
									{shift.type || 'Default'} &middot; {shift.breaks.length} break{shift.breaks
										.length === 1
										? ''
										: 's'}
								</span>
							</td>

							<td class="hidden px-4 py-3 text-muted md:table-cell md:px-6">
								{#if shift.end}
									<Tooltip text={exactTime(shift.end)}>{relativeTime(shift.end)}</Tooltip>
								{:else}
									<span class="flex items-center gap-1.5 text-green-500">
										<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
										Still on duty
									</span>
								{/if}
							</td>

							<td class="px-4 py-3 md:px-6">{shift.end ? duration(shift.duration) : '-'}</td>
							<td class="hidden px-4 py-3 text-muted md:table-cell md:px-6"
								>{shift.type || 'Default'}</td
							>
							<td class="hidden px-4 py-3 text-muted md:table-cell md:px-6"
								>{shift.breaks.length}</td
							>

							<td class="px-4 py-3 text-right md:px-6">
								{#if shift.id}
									<Tooltip text="Manage shift">
										<button
											type="button"
											onclick={() => (managing = shift)}
											aria-label="Manage this shift"
											class="tap inline-flex items-center rounded-md border border-line bg-white/5 p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
										>
											<SlidersHorizontal class="h-3.5 w-3.5" />
										</button>
									</Tooltip>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<Pager total={data.shifts.length} {perPage} bind:page={shiftPage} label="shifts" />
	{/if}
</Card>

<Card title="Punishments" description="Moderations logged against this member, newest first.">
	{#if !data.punishments}
		<p class="px-6 py-10 text-center text-sm text-muted">
			Their punishments are unavailable right now. Reload in a moment.
		</p>
	{:else if !data.punishments.length}
		<p class="px-6 py-10 text-center text-sm text-muted">No punishments recorded.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm md:min-w-160">
				<thead class="text-xs tracking-wide text-muted uppercase">
					<tr class="border-b border-line">
						<th scope="col" class="px-4 py-3 font-medium md:px-6">Type</th>
						<th scope="col" class="hidden px-4 py-3 font-medium md:table-cell md:px-6">Reason</th>
						<th scope="col" class="hidden px-4 py-3 font-medium md:table-cell md:px-6">Moderator</th
						>
						<th scope="col" class="px-4 py-3 font-medium md:px-6">When</th>
					</tr>
				</thead>

				<tbody class="divide-y divide-line">
					{#each punishments as punishment (punishment.id)}
						<tr>
							<td class="px-4 py-3 md:px-6">
								{punishment.type || 'Unknown'}
								<span class="mt-1 block text-xs text-muted md:hidden">
									{punishment.reason || 'No reason given'}
								</span>
							</td>

							<td class="hidden max-w-80 px-4 py-3 text-muted md:table-cell md:px-6">
								<span class="line-clamp-2">{punishment.reason || 'No reason given'}</span>
							</td>

							<td class="hidden px-4 py-3 text-muted md:table-cell md:px-6"
								>{punishment.moderator || 'Unknown'}</td
							>

							<td class="px-4 py-3 text-muted md:px-6">
								<Tooltip text={exactTime(punishment.timestamp)}>
									{relativeTime(punishment.timestamp)}
								</Tooltip>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<Pager
			total={data.punishments.length}
			{perPage}
			bind:page={punishmentPage}
			label="punishments"
		/>
	{/if}
</Card>

<Card title="Moderation logs" description="Punishments this member has handed out, newest first.">
	{#if !data.logs}
		<p class="px-6 py-10 text-center text-sm text-muted">
			Their logs are unavailable right now. Reload in a moment.
		</p>
	{:else if !data.logs.length}
		<p class="px-6 py-10 text-center text-sm text-muted">No moderations logged.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm md:min-w-160">
				<thead class="text-xs tracking-wide text-muted uppercase">
					<tr class="border-b border-line">
						<th scope="col" class="px-4 py-3 font-medium md:px-6">Player</th>
						<th scope="col" class="px-4 py-3 font-medium md:px-6">Type</th>
						<th scope="col" class="hidden px-4 py-3 font-medium md:table-cell md:px-6">Reason</th>
						<th scope="col" class="hidden px-4 py-3 font-medium md:table-cell md:px-6">When</th>
					</tr>
				</thead>

				<tbody class="divide-y divide-line">
					{#each logs as log (log.id)}
						<tr>
							<td class="px-4 py-3 md:px-6">
								{log.username}
								<span class="mt-1 block text-xs text-muted md:hidden">
									{log.reason || 'No reason given'}
								</span>
							</td>

							<td class="px-4 py-3 text-muted md:px-6">{log.type || 'Unknown'}</td>

							<td class="hidden max-w-80 px-4 py-3 text-muted md:table-cell md:px-6">
								<span class="line-clamp-2">{log.reason || 'No reason given'}</span>
							</td>

							<td class="hidden px-4 py-3 text-muted md:table-cell md:px-6">
								<Tooltip text={exactTime(log.timestamp)}>{relativeTime(log.timestamp)}</Tooltip>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<Pager total={data.logs.length} {perPage} bind:page={logPage} label="logs" />
	{/if}
</Card>

<Card
	title="Infraction breakdown"
	description="How this member's infractions land over time and across types."
>
	<InfractionVisualizer infractions={data.infractions ?? []} />
</Card>

<Card
	id="infractions"
	title="Infractions"
	description="Infractions this member has received, newest first."
>
	{#if !data.infractions}
		<p class="px-6 py-10 text-center text-sm text-muted">
			Their infractions are unavailable right now. Reload in a moment.
		</p>
	{:else if !data.infractions.length}
		<p class="px-6 py-10 text-center text-sm text-muted">No infractions recorded.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm md:min-w-160">
				<thead class="text-xs tracking-wide text-muted uppercase">
					<tr class="border-b border-line">
						<th scope="col" class="px-4 py-3 font-medium md:px-6">Type</th>
						<th scope="col" class="hidden px-4 py-3 font-medium md:table-cell md:px-6">Reason</th>
						<th scope="col" class="hidden px-4 py-3 font-medium md:table-cell md:px-6">Issued by</th
						>
						<th scope="col" class="px-4 py-3 font-medium md:px-6">When</th>
						<th scope="col" class="px-4 py-3 font-medium md:px-6">
							<span class="sr-only">Revoke</span>
						</th>
					</tr>
				</thead>

				<tbody class="divide-y divide-line">
					{#each infractions as entry (entry.id)}
						<tr class={entry.revoked ? 'opacity-50' : ''}>
							<td class="px-4 py-3 md:px-6">
								<span class="flex flex-wrap items-center gap-1.5">
									{entry.type || 'Unknown'}
									{#if entry.escalated}
										<span
											title="Escalated"
											class="flex items-center gap-1 rounded-md border border-yellow-400/25 bg-yellow-400/10 px-1.5 py-0.5 text-xs font-medium text-yellow-400"
										>
											<TrendingUp class="h-3 w-3" />
											Escalated
										</span>
									{/if}
									{#if entry.revoked}
										<span
											class="rounded-md border border-line bg-white/5 px-2 py-0.5 text-xs text-muted"
										>
											Revoked
										</span>
									{/if}
								</span>
								<span class="mt-1 block text-xs text-muted md:hidden">
									{entry.reason || 'No reason given'}
								</span>
							</td>

							<td class="hidden max-w-80 px-4 py-3 text-muted md:table-cell md:px-6">
								<span class="line-clamp-2">{entry.reason || 'No reason given'}</span>
							</td>

							<td class="hidden px-4 py-3 text-muted md:table-cell md:px-6"
								>{entry.issuer || 'Unknown'}</td
							>

							<td class="px-4 py-3 text-muted md:px-6">
								<Tooltip text={exactTime(entry.timestamp)}>{relativeTime(entry.timestamp)}</Tooltip>
							</td>

							<td class="px-4 py-3 text-right md:px-6">
								<div class="flex items-center justify-end gap-2">
									{#if !entry.revoked}
										<Tooltip text="Edit infraction">
											<button
												type="button"
												onclick={() => (editing = entry)}
												aria-label="Edit this infraction"
												class="tap inline-flex items-center rounded-md border border-line bg-white/5 p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
											>
												<Pencil class="h-3.5 w-3.5" />
											</button>
										</Tooltip>

										<Tooltip text="Revoke infraction">
											<button
												type="button"
												onclick={() => (revoking = entry)}
												aria-label="Revoke this infraction"
												class="tap inline-flex items-center rounded-md border border-line bg-white/5 p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
											>
												<Undo2 class="h-3.5 w-3.5" />
											</button>
										</Tooltip>
									{/if}

									<Tooltip text="Delete infraction">
										<button
											type="button"
											onclick={() => (deleting = entry)}
											aria-label="Delete this infraction"
											class="tap inline-flex items-center rounded-md border border-line bg-white/5 p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
										>
											<Trash2 class="h-3.5 w-3.5" />
										</button>
									</Tooltip>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<Pager
			total={data.infractions.length}
			{perPage}
			bind:page={infractionPage}
			label="infractions"
		/>
	{/if}
</Card>

<InfractionCreate
	bind:open={creating}
	guildId={data.guild.id}
	types={data.types}
	escalations={data.escalations}
	fixedMember={target}
/>
<ManageShift bind:shift={managing} />
<InfractionEditor bind:infraction={editing} types={data.types} />
<InfractionDelete bind:infraction={deleting} />
<InfractionRevoke bind:infraction={revoking} />
