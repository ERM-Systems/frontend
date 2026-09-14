<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { resolve } from '$app/paths';
	import { guildData } from '$lib/dashboardData.svelte';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import type { DiscordProfile } from '$lib/server/discord';
	import { defaultAvatar, duration, exactTime, relativeTime } from '$lib/staff';
	import type { PageData } from './$types';

	type Profiles = Record<string, DiscordProfile | null>;

	let { data }: { data: PageData } = $props();

	const session = $derived(data.session);
	const length = $derived(Math.max(0, session.endedAt - session.startedAt));
	const peak = $derived(Math.max(session.maxPlayers, ...session.playerCounts, 0));

	const average = $derived(
		session.playerCounts.length
			? Math.round(
					session.playerCounts.reduce((sum, count) => sum + count, 0) / session.playerCounts.length
				)
			: 0
	);

	function person(profiles: Profiles, id: string): { name: string; avatarUrl: string } {
		const profile = profiles[id];
		return {
			name: profile?.username || id,
			avatarUrl: profile?.avatarUrl || defaultAvatar(id)
		};
	}

	function points(counts: number[]): string {
		if (counts.length < 2) return '';

		const highest = Math.max(...counts, 1);
		const step = 100 / (counts.length - 1);

		return counts.map((count, index) => `${index * step},${40 - (count / highest) * 38}`).join(' ');
	}
</script>

<svelte:head><title>Session - {guildData.name}</title></svelte:head>

<PageHeader description="Everything recorded for this session." />

<a
	href={resolve('/[guildID]/dashboard/sessions', { guildID: data.guild.id })}
	class="mt-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
>
	<ArrowLeft class="h-4 w-4" />
	Back to sessions
</a>

{#snippet tile(label: string, value: string)}
	<div class="rounded-lg border border-line bg-white/2 px-4 py-3">
		<p class="text-xs tracking-wide text-muted uppercase">{label}</p>
		<p class="mt-1 text-2xl font-semibold">{value}</p>
	</div>
{/snippet}

{#snippet member(profiles: Profiles, id: string)}
	{@const who = person(profiles, id)}
	<div class="settled flex items-center gap-2">
		<img
			src={who.avatarUrl}
			alt=""
			onerror={(event) => {
				const image = event.currentTarget as HTMLImageElement;
				const fallback = defaultAvatar(id);
				if (image.src !== fallback) image.src = fallback;
			}}
			class="h-6 w-6 rounded-full"
		/>
		<span class="truncate text-sm">{who.name}</span>
	</div>
{/snippet}

{#snippet pending(label: string)}
	<div class="flex items-center gap-2">
		<div class="skeleton h-6 w-6 rounded-full bg-white/10"></div>
		<div class="skeleton h-3 w-24 rounded bg-white/10"></div>
		<span class="sr-only">{label}</span>
	</div>
{/snippet}

<div class="mt-6 flex flex-col gap-6">
	<Card title="Summary" description="When this session ran and who ran it.">
		<div class="grid gap-4 px-6 py-5 sm:grid-cols-4">
			{@render tile('Length', length ? duration(length) : '-')}
			{@render tile('Peak players', String(peak))}
			{@render tile('Average players', String(average))}
			{@render tile('Votes', String(session.votes))}
		</div>

		<div class="grid gap-6 border-t border-line px-6 py-5 sm:grid-cols-2">
			<div>
				<p class="text-xs tracking-wide text-muted uppercase">Started</p>
				<p class="mt-1 text-sm">{exactTime(session.startedAt)}</p>
				<p class="mt-1 text-sm text-muted">{relativeTime(session.startedAt)}</p>
				{#if session.startedBy}
					<div class="mt-2">
						{#await data.profiles}
							{@render pending('Loading who started this session')}
						{:then profiles}
							{@render member(profiles, session.startedBy)}
						{/await}
					</div>
				{/if}
			</div>

			<div>
				<p class="text-xs tracking-wide text-muted uppercase">Ended</p>
				<p class="mt-1 text-sm">{exactTime(session.endedAt)}</p>
				<p class="mt-1 text-sm text-muted">{relativeTime(session.endedAt)}</p>
				{#if session.endedBy}
					<div class="mt-2">
						{#await data.profiles}
							{@render pending('Loading who ended this session')}
						{:then profiles}
							{@render member(profiles, session.endedBy)}
						{/await}
					</div>
				{/if}
			</div>
		</div>
	</Card>

	<Card title="Players" description="Player counts sampled while the session was running.">
		{#if points(session.playerCounts)}
			<div class="px-6 py-5">
				<svg viewBox="0 0 100 40" preserveAspectRatio="none" class="h-32 w-full">
					<polyline
						points={points(session.playerCounts)}
						fill="none"
						stroke="currentColor"
						stroke-width="1"
						stroke-linecap="round"
						stroke-linejoin="round"
						vector-effect="non-scaling-stroke"
						class="text-red-500"
					/>
				</svg>

				<div class="mt-2 flex justify-between text-xs text-muted">
					<span>{exactTime(session.startedAt)}</span>
					<span>{exactTime(session.endedAt)}</span>
				</div>
			</div>
		{:else}
			<Callout>Not enough samples were taken to graph this session.</Callout>
		{/if}
	</Card>

	<Card
		title="Server activity"
		description="Logs recorded between the start and end of the session."
	>
		<div class="grid gap-4 px-6 py-5 sm:grid-cols-3">
			{@render tile('Commands', String(session.commands))}
			{@render tile('Kills', String(session.kills))}
			{@render tile('Joins', String(session.joins))}
		</div>
	</Card>

	<Card title="Votes" description="Members who voted for this session to run.">
		{#if !session.votedUsers.length}
			<Callout>Nobody voted for this session.</Callout>
		{:else}
			<div class="grid gap-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
				{#await data.profiles}
					{#each session.votedUsers as id (id)}
						{@render pending('Loading voters')}
					{/each}
				{:then profiles}
					{#each session.votedUsers as id (id)}
						{@render member(profiles, id)}
					{/each}
				{/await}
			</div>
		{/if}
	</Card>

	<Card title="Shifts" description="Staff whose shifts overlapped this session, longest first.">
		{#await data.shifts}
			<div class="flex flex-col gap-4 px-6 py-5">
				<div class="skeleton h-16 rounded-lg bg-white/8"></div>
				<div class="skeleton h-16 rounded-lg bg-white/8"></div>
			</div>
		{:then shifts}
			{#if !shifts.length}
				<Callout>No shifts overlapped this session.</Callout>
			{:else}
				<div class="settled">
					<div class="grid gap-4 px-6 py-5 sm:grid-cols-2">
						{@render tile('Staff on duty', String(shifts.length))}
						{@render tile(
							'Time on duty',
							duration(shifts.reduce((sum, shift) => sum + shift.duration, 0)) || '-'
						)}
					</div>

					<div class="divide-y divide-line border-t border-line">
						{#each shifts as shift (shift.userId + shift.start)}
							<div class="flex flex-wrap items-baseline justify-between gap-2 px-6 py-4">
								<div class="min-w-0">
									<p class="font-medium">{shift.nickname || shift.username || shift.userId}</p>
									<p class="mt-1 text-sm text-muted">
										{shift.type} · {exactTime(shift.start)}
									</p>
								</div>

								<div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
									<span class="text-muted">
										Duration <span class="font-medium text-white">{duration(shift.duration)}</span>
									</span>
									<span class="text-muted">
										Breaks <span class="font-medium text-white">{shift.breaks.length}</span>
									</span>
									<span class="text-muted">
										Moderations <span class="font-medium text-white">{shift.moderations}</span>
									</span>
									{#if !shift.end}
										<span class="font-medium text-green-400">On duty</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/await}
	</Card>
</div>
