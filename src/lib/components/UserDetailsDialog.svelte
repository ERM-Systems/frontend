<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import X from '@lucide/svelte/icons/x';
	import { fade, fly } from 'svelte/transition';
	import { defaultAvatar, duration, exactTime, relativeTime } from '$lib/staff';
	import type { ResolvedPathname } from '$app/types';

	interface DetailedMember {
		userId: string;
		username: string;
		nickname: string;
		avatarUrl: string;
		shifts: number;
		total: number;
		lastShift: number;
		onDuty: boolean;
		moderations: number;
	}

	let { member = $bindable(), guildId }: { member: DetailedMember | null; guildId: string } =
		$props();

	let counts = $state<Record<string, number> | null>(null);

	const name = $derived(member?.nickname || member?.username || 'Unknown member');

	const profile = $derived(
		`/${guildId}/dashboard/staff-management/overview/${member?.userId ?? ''}` as ResolvedPathname
	);

	const infractions = $derived(
		counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : 0
	);

	$effect(() => {
		const userId = member?.userId;
		if (!userId) return;

		let active = true;
		counts = null;

		fetch(`/${guildId}/dashboard/staff-management/lookup?userId=${userId}`)
			.then((response) => (response.ok ? response.json() : { counts: {} }))
			.then((body) => active && (counts = (body.counts ?? {}) as Record<string, number>))
			.catch(() => active && (counts = {}));

		return () => {
			active = false;
		};
	});
</script>

{#if member}
	{@const shown = member}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (member = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-md max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<div class="flex items-start gap-4 border-b border-line px-6 py-5">
			<img
				src={shown.avatarUrl || defaultAvatar(shown.userId)}
				alt=""
				onerror={(event) => {
					const image = event.currentTarget as HTMLImageElement;
					const fallback = defaultAvatar(shown.userId);
					if (image.src !== fallback) image.src = fallback;
				}}
				class="h-12 w-12 shrink-0 rounded-xl bg-white/8 object-cover"
			/>

			<div class="min-w-0 flex-1">
				<h2 class="truncate text-lg font-semibold">{name}</h2>
				{#if shown.onDuty}
					<p class="flex items-center gap-1.5 text-xs text-green-500">
						<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
						On duty now
					</p>
				{:else}
					<p class="text-xs text-muted">Last shift {relativeTime(shown.lastShift)}</p>
				{/if}
			</div>

			<button
				type="button"
				onclick={() => (member = null)}
				aria-label="Close"
				class="-mt-1 -mr-2 rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-white"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<dl class="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-5 text-sm">
			<div class="min-w-0">
				<dt class="text-muted">Username</dt>
				<dd class="mt-0.5 truncate">{shown.username || 'Unknown'}</dd>
			</div>

			<div class="min-w-0">
				<dt class="text-muted">Nickname</dt>
				<dd class="mt-0.5 truncate">{shown.nickname || 'None set'}</dd>
			</div>

			<div class="col-span-2 min-w-0">
				<dt class="text-muted">Discord ID</dt>
				<dd class="mt-0.5 truncate font-mono">{shown.userId}</dd>
			</div>
		</dl>

		<dl class="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
			<div class="bg-surface px-4 py-3">
				<dt class="text-xs tracking-wide text-muted uppercase">Shifts</dt>
				<dd class="mt-1 text-xl font-semibold">{shown.shifts}</dd>
			</div>

			<div class="bg-surface px-4 py-3">
				<dt class="text-xs tracking-wide text-muted uppercase">On duty</dt>
				<dd class="mt-1 text-xl font-semibold">{duration(shown.total)}</dd>
			</div>

			<div class="bg-surface px-4 py-3">
				<dt class="text-xs tracking-wide text-muted uppercase">Moderations</dt>
				<dd class="mt-1 text-xl font-semibold">{shown.moderations}</dd>
			</div>

			<div class="bg-surface px-4 py-3">
				<dt class="text-xs tracking-wide text-muted uppercase">Infractions</dt>
				<dd class="mt-1 text-xl font-semibold">{counts ? infractions : '-'}</dd>
			</div>
		</dl>

		{#if counts && infractions}
			<ul class="flex flex-wrap gap-2 border-t border-line px-6 py-4">
				{#each Object.entries(counts) as [type, count] (type)}
					<li class="rounded-full border border-line bg-white/5 px-2.5 py-1 text-xs text-muted">
						{type}
						<span class="font-semibold text-white">{count}</span>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="flex items-center gap-3 border-t border-line px-6 py-4">
			<p class="min-w-0 flex-1 truncate text-xs text-muted">
				{shown.lastShift ? exactTime(shown.lastShift) : 'No shifts recorded'}
			</p>

			<a
				href={profile}
				class="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				Open profile
				<ExternalLink class="h-3.5 w-3.5" />
			</a>
		</div>
	</div>
{/if}
