<script lang="ts">
	import History from '@lucide/svelte/icons/history';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Search from '@lucide/svelte/icons/search';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Card from '$lib/components/settings/Card.svelte';
	import InfractionEditor from '$lib/components/InfractionEditor.svelte';
	import InfractionDelete from '$lib/components/InfractionDelete.svelte';
	import InfractionCreate from './InfractionCreate.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import { exactTime, relativeTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { ResolvedPathname } from '$app/types';
	import type { Infraction } from '$lib/server/staff';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const historyHref = (userId: string) =>
		`/${data.guild.id}/dashboard/staff-management/overview/${userId}#infractions` as ResolvedPathname;

	const cap = 100;

	let creating = $state(false);
	let editing = $state<Infraction | null>(null);
	let deleting = $state<Infraction | null>(null);
	let revoking = $state('');
	let query = $state('');
	let type = $state('');
	let status = $state('');
	let expanded = $state(false);

	const infractions = $derived(data.infractions ?? []);

	const types = $derived([
		{ value: '', label: 'All types' },
		...[...new Set(infractions.map((entry) => entry.type).filter(Boolean))]
			.sort()
			.map((value) => ({ value, label: value }))
	]);

	const statuses = [
		{ value: '', label: 'All infractions' },
		{ value: 'active', label: 'Active' },
		{ value: 'revoked', label: 'Revoked' }
	];

	const filtered = $derived.by(() => {
		const term = query.trim().toLowerCase();

		return infractions
			.filter((entry) => {
				if (type && entry.type !== type) return false;
				if (status && entry.revoked !== (status === 'revoked')) return false;
				if (!term) return true;

				return [entry.username, entry.issuer, entry.type, entry.reason].some((field) =>
					field.toLowerCase().includes(term)
				);
			})
			.sort((a, b) =>
				a.revoked === b.revoked ? b.timestamp - a.timestamp : Number(a.revoked) - Number(b.revoked)
			);
	});

	const visible = $derived(expanded ? filtered : filtered.slice(0, cap));
</script>

<Card title="Infractions" description="Every infraction recorded in this server, newest first.">
	{#snippet action()}
		<button
			type="button"
			onclick={() => (creating = true)}
			class="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
		>
			<Plus class="h-4 w-4" />
			Issue infraction
		</button>
	{/snippet}

	{#if !data.infractions}
		<p class="px-6 py-10 text-center text-sm text-muted">
			Your infractions are unavailable right now. Reload in a moment.
		</p>
	{:else if !infractions.length}
		<p class="px-6 py-10 text-center text-sm text-muted">No infractions recorded.</p>
	{:else}
		<div class="flex flex-col gap-3 border-b border-line px-6 py-4 sm:flex-row">
			<div
				class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-white/5 px-3"
			>
				<Search class="h-4 w-4 shrink-0 text-muted" />
				<input
					bind:value={query}
					placeholder="Search member, issuer, type or reason"
					aria-label="Search infractions"
					class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
				/>
			</div>

			<div class="shrink-0 sm:w-56">
				<Select options={types} bind:value={type} placeholder="All types" />
			</div>

			<div class="shrink-0 sm:w-56">
				<Select options={statuses} bind:value={status} placeholder="All infractions" />
			</div>
		</div>

		{#if !filtered.length}
			<p class="px-6 py-10 text-center text-sm text-muted">No infractions match that search.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm md:min-w-160">
					<thead class="text-xs tracking-wide text-muted uppercase">
						<tr class="border-b border-line">
							<th scope="col" class="px-3 py-3 font-medium md:px-6">Member</th>
							<th scope="col" class="px-3 py-3 font-medium md:px-6">Type</th>
							<th scope="col" class="hidden px-3 py-3 font-medium md:table-cell md:px-6">Reason</th>
							<th scope="col" class="hidden px-3 py-3 font-medium md:table-cell md:px-6"
								>Issued by</th
							>
							<th scope="col" class="px-3 py-3 font-medium md:px-6">When</th>
							<th scope="col" class="px-3 py-3 font-medium md:px-6">
								<span class="sr-only">Revoke</span>
							</th>
						</tr>
					</thead>

					<tbody class="divide-y divide-line">
						{#each visible as entry (entry.id)}
							<tr class={entry.revoked ? 'opacity-50' : ''}>
								<td class="px-3 py-3 md:px-6">
									<span class="font-medium">{entry.username || 'Unknown member'}</span>
									{#if entry.userId}
										<Tooltip text="Infraction history">
											<a
												href={historyHref(entry.userId)}
												aria-label="View {entry.username || 'this member'}'s infraction history"
												class="tap ml-2 inline-flex items-center rounded-md border border-line bg-white/5 p-1 align-middle text-muted transition-colors hover:bg-white/10 hover:text-white"
											>
												<History class="h-3.5 w-3.5" />
											</a>
										</Tooltip>
									{/if}
									{#if entry.revoked}
										<span
											class="ml-2 rounded-md border border-line bg-white/5 px-2 py-0.5 text-xs text-muted"
										>
											Revoked
										</span>
									{/if}

									<span class="mt-1 block text-xs text-muted md:hidden">
										<span class="line-clamp-2">{entry.reason || 'No reason given'}</span>
										<span class="mt-0.5 block">By {entry.issuer || 'Unknown'}</span>
									</span>
								</td>

								<td class="px-3 py-3 md:px-6">
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
									</span>
								</td>

								<td class="hidden max-w-80 px-3 py-3 text-muted md:table-cell md:px-6">
									<span class="line-clamp-2">{entry.reason || 'No reason given'}</span>
								</td>

								<td class="hidden px-3 py-3 text-muted md:table-cell md:px-6">
									{entry.issuer || 'Unknown'}
								</td>

								<td class="px-3 py-3 text-muted md:px-6">
									<Tooltip text={exactTime(entry.timestamp)}>
										{relativeTime(entry.timestamp)}
									</Tooltip>
								</td>

								<td class="px-3 py-3 text-right md:px-6">
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

											<form
												method="POST"
												action="?/revoke"
												use:enhance={() => {
													revoking = entry.id;

													return async ({ result }) => {
														revoking = '';

														if (result.type === 'failure') {
															toast(
																String(result.data?.message ?? 'Could not revoke that infraction.'),
																'error'
															);
															return;
														}

														await invalidateAll();
														toast('Infraction revoked.', 'success');
													};
												}}
											>
												<input type="hidden" name="infractionId" value={entry.id} />
												<Tooltip text="Revoke infraction">
													<button
														type="submit"
														disabled={revoking === entry.id}
														aria-label="Revoke this infraction"
														class="tap inline-flex items-center rounded-md border border-line bg-white/5 p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
													>
														<Undo2 class="h-3.5 w-3.5" />
													</button>
												</Tooltip>
											</form>
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

			{#if filtered.length > cap}
				<div class="flex flex-wrap items-center gap-3 border-t border-line px-6 py-4">
					<p class="min-w-0 flex-1 text-sm text-muted">
						Showing {visible.length} of {filtered.length} infractions.
					</p>

					<button
						type="button"
						onclick={() => (expanded = !expanded)}
						class="rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
					>
						{expanded ? 'Show fewer' : 'Show all'}
					</button>
				</div>
			{/if}
		{/if}
	{/if}
</Card>

<InfractionEditor bind:infraction={editing} types={data.types} />
<InfractionDelete bind:infraction={deleting} />

<InfractionCreate
	bind:open={creating}
	guildId={data.guild.id}
	types={data.types}
	escalations={data.escalations}
/>
