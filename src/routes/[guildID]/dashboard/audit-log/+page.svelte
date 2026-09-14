<script lang="ts">
	import Info from '@lucide/svelte/icons/info';
	import X from '@lucide/svelte/icons/x';
	import { fade, fly } from 'svelte/transition';
	import { auditLabel, auditTarget } from '$lib/audit';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import { dashboardHref } from '$lib/dashboard';
	import { defaultAvatar, exactTime, relativeTime } from '$lib/staff';
	import type { AuditEntry } from '$lib/server/audit';
	import type { ResolvedPathname } from '$app/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let viewing = $state<AuditEntry | null>(null);

	const pages = $derived(Math.max(1, Math.ceil(data.total / data.perPage)));
	const first = $derived((data.page - 1) * data.perPage + 1);
	const last = $derived(Math.min(data.page * data.perPage, data.total));

	const href = (target: number) =>
		`${dashboardHref(data.guild.id, 'audit-log')}?page=${target}` as ResolvedPathname;

	function raw(entry: AuditEntry): string {
		const { action, details } = entry;

		const body =
			details === null || details === undefined
				? {}
				: typeof details === 'object' && !Array.isArray(details)
					? (details as Record<string, unknown>)
					: { details };

		return JSON.stringify({ action, ...body }, null, 2);
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (viewing = null)} />

<PageHeader description="Every change made from the dashboard, and who made it." />

<div class="mt-8 flex flex-col gap-6">
	<Card title="Activity" description="Newest first. Only management can see this page.">
		<div class="divide-y divide-line">
			{#each data.entries as entry (entry.id)}
				<div class="flex items-center gap-4 px-6 py-4">
					<img
						src={entry.avatarUrl}
						alt=""
						onerror={(event) => {
							const image = event.currentTarget as HTMLImageElement;
							const fallback = defaultAvatar(entry.userId);
							if (image.src !== fallback) image.src = fallback;
						}}
						class="h-9 w-9 shrink-0 rounded-full"
					/>

					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">
							{entry.username || 'Unknown user'}
							<span class="font-normal text-muted">{entry.userId}</span>
						</p>
						<p class="mt-0.5 truncate text-sm text-muted" title={entry.action}>
							{auditLabel(entry.action)}
							{#if auditTarget(entry.details)}
								<span class="text-white/40">{auditTarget(entry.details)}</span>
							{/if}
							{#if entry.accessLevel}
								<span class="text-white/40">- {entry.accessLevel}</span>
							{/if}
						</p>
					</div>

					<p class="hidden shrink-0 text-sm text-muted sm:block" title={exactTime(entry.timestamp)}>
						{relativeTime(entry.timestamp)}
					</p>

					<button
						type="button"
						onclick={() => (viewing = entry)}
						aria-label="View raw data"
						title="View raw data"
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-white/5 hover:text-white"
					>
						<Info class="h-4 w-4" />
					</button>
				</div>
			{:else}
				{#if !data.unavailable}
					<p class="px-6 py-10 text-center text-sm text-muted">Nothing has been changed yet.</p>
				{/if}
			{/each}
		</div>

		{#if data.unavailable}
			<Callout tone="warning">
				The audit log could not be loaded. Check the bot is running and up to date, then try again.
			</Callout>
		{/if}

		{#if pages > 1}
			<div class="flex flex-wrap items-center gap-3 border-t border-line px-6 py-4">
				<p class="flex-1 text-sm text-muted">
					Showing {first} to {last} of {data.total} changes
				</p>

				<a
					href={href(data.page - 1)}
					aria-disabled={data.page === 1}
					class="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white aria-disabled:pointer-events-none aria-disabled:opacity-40 pointer-coarse:py-3"
				>
					Previous
				</a>

				<span class="text-sm text-muted">{data.page} of {pages}</span>

				<a
					href={href(data.page + 1)}
					aria-disabled={data.page === pages}
					class="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white aria-disabled:pointer-events-none aria-disabled:opacity-40 pointer-coarse:py-3"
				>
					Next
				</a>
			</div>
		{/if}
	</Card>
</div>

{#if viewing}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (viewing = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-160 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		aria-label="Raw Data"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<div class="flex items-start gap-4">
			<div class="min-w-0 flex-1">
				<h2 class="text-lg font-semibold">Raw Data</h2>
			</div>

			<button
				type="button"
				onclick={() => (viewing = null)}
				aria-label="Close"
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-white/5 hover:text-white"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<pre
			class="mt-5 max-h-[60dvh] overflow-auto rounded-lg border border-line bg-black/30 p-4 text-xs text-muted">{raw(
				viewing
			)}</pre>
	</div>
{/if}
