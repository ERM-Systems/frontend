<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Gem from '@lucide/svelte/icons/gem';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Select from '$lib/components/settings/Select.svelte';
	import { toast } from '$lib/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let busy = $state('');
	let picked = $state<Record<string, string>>({});

	const serverOptions = $derived(
		data.servers.map((server) => ({
			value: server.id,
			label: server.name,
			iconUrl: server.iconUrl
		}))
	);

	function target(spotId: string): string {
		return picked[spotId] ?? data.servers[0]?.id ?? '';
	}

	function expiryLabel(expiry: number): string {
		return new Date(expiry * 1000).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head><title>Billing - ERM Systems</title></svelte:head>

<section class="mx-auto max-w-3xl px-6 py-16">
	<h1 class="text-4xl font-bold tracking-[-0.03em]">Billing</h1>
	<p class="mt-3 text-muted">Manage your whitelabel spots and where they are used.</p>

	<div class="mt-10 flex flex-col gap-6">
		<div class="rounded-xl border border-line bg-surface p-6">
			<div class="flex flex-wrap items-start gap-4 sm:flex-nowrap">
				<div
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white/5"
				>
					<Gem class="h-5 w-5 text-muted" />
				</div>

				<div class="min-w-40 flex-1">
					<h2 class="font-semibold">Whitelabel</h2>
					<p class="mt-1 text-sm text-muted">
						Run ERM under your own bot name, avatar and banner. Each whitelabel spot can be assigned
						to one server, and moved between servers whenever you like.
					</p>
				</div>

				<button
					type="button"
					disabled
					class="shrink-0 cursor-not-allowed rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold text-muted opacity-70 pointer-coarse:py-3"
				>
					Purchase
				</button>
			</div>
		</div>

		<div class="rounded-xl border border-line bg-surface">
			<div class="flex flex-wrap items-center gap-3 border-b border-line px-6 py-5">
				<div class="flex-1">
					<h2 class="font-semibold">Your spots</h2>
					<p class="mt-1 text-sm text-muted">Assign a spot to a server to whitelabel it.</p>
				</div>

				{#if data.spots}
					<span class="rounded-full border border-line bg-white/5 px-3 py-1 text-xs text-muted">
						{data.spots.available} available - {data.spots.used} in use
					</span>
				{/if}
			</div>

			{#if !data.spots}
				<p class="px-6 py-5 text-sm text-muted">
					Your whitelabel spots are unavailable right now. Reload in a moment.
				</p>
			{:else if !data.spots.spots.length}
				<div class="px-6 py-12 text-center">
					<div
						class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
					>
						<Sparkles class="h-5 w-5 text-muted" />
					</div>
					<p class="mt-4 font-medium">No whitelabel spots yet</p>
					<p class="mx-auto mt-1 max-w-80 text-sm text-muted">
						When you have a whitelabel spot it will show here, ready to assign to one of your
						servers.
					</p>
				</div>
			{:else}
				<ul class="divide-y divide-line">
					{#each data.spots.spots as spot (spot.id)}
						<li class="flex flex-wrap items-center gap-4 px-6 py-4">
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									{#if !spot.active}
										<span
											class="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-300"
										>
											Expired
										</span>
									{:else if spot.guildId}
										<span
											class="rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-300"
										>
											Assigned
										</span>
									{:else}
										<span
											class="rounded-full border border-line bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted"
										>
											Unassigned
										</span>
									{/if}

									{#if spot.guildId}
										<span class="text-sm font-medium">{spot.guildName || spot.guildId}</span>
									{/if}
								</div>

								<p class="mt-1 text-xs text-muted">
									{spot.active ? 'Renews' : 'Expired'}
									{expiryLabel(spot.expiry)}
								</p>
							</div>

							{#if spot.guildId}
								<form
									method="POST"
									action="?/unassign"
									use:enhance={() => {
										busy = spot.id;

										return async ({ result }) => {
											busy = '';

											if (result.type === 'failure') {
												toast(
													String(result.data?.message ?? 'Could not unassign that spot.'),
													'error'
												);
												return;
											}

											await invalidateAll();
											toast('Whitelabel spot unassigned.', 'success');
										};
									}}
								>
									<input type="hidden" name="spotId" value={spot.id} />
									<button
										type="submit"
										disabled={busy === spot.id}
										class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
									>
										{busy === spot.id ? 'Removing...' : 'Unassign'}
									</button>
								</form>
							{:else if spot.active}
								<form
									method="POST"
									action="?/assign"
									class="flex items-center gap-2"
									use:enhance={() => {
										busy = spot.id;

										return async ({ result }) => {
											busy = '';

											if (result.type === 'failure') {
												toast(
													String(result.data?.message ?? 'Could not assign that spot.'),
													'error'
												);
												return;
											}

											await invalidateAll();
											toast('Whitelabel spot assigned.', 'success');
										};
									}}
								>
									<input type="hidden" name="spotId" value={spot.id} />

									{#if data.servers.length}
										<input type="hidden" name="guildId" value={target(spot.id)} />

										<div class="w-56">
											<Select
												options={serverOptions}
												bind:value={() => target(spot.id), (next) => (picked[spot.id] = next)}
												placeholder="Choose a server"
											/>
										</div>

										<button
											type="submit"
											disabled={busy === spot.id}
											class="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
										>
											<Check class="h-4 w-4" />
											{busy === spot.id ? 'Assigning...' : 'Assign'}
										</button>
									{:else}
										<span class="text-xs text-muted">
											You need a management role in a server to assign a spot.
										</span>
									{/if}
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</section>
