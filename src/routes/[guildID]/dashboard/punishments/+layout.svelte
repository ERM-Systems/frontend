<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import { managementLevel } from '$lib/dashboard';
	import { guildData } from '$lib/dashboardData.svelte';
	import type { ResolvedPathname } from '$app/types';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const tabs = $derived(
		[
			{ slug: '', label: 'Settings', management: true },
			{ slug: 'manage', label: 'Manage Punishments', management: false }
		].filter((tab) => !tab.management || guildData.level >= managementLevel)
	);

	const current = $derived(page.url.pathname.split('/')[4] ?? '');

	const href = (slug: string) =>
		`/${data.guild.id}/dashboard/punishments${slug ? `/${slug}` : ''}` as ResolvedPathname;
</script>

<PageHeader
	description="Where moderation is logged, what your staff can issue, and every punishment on record."
/>

{#if tabs.length > 1}
	<nav class="mt-8 flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
		{#each tabs as tab (tab.slug)}
			<a
				href={href(tab.slug)}
				aria-current={current === tab.slug ? 'page' : undefined}
				class="rounded-lg px-4 py-2 text-sm transition-colors pointer-coarse:py-3 {current ===
				tab.slug
					? 'bg-white/8 font-medium text-white'
					: 'text-muted hover:bg-white/5 hover:text-white'}"
			>
				{tab.label}
			</a>
		{/each}
	</nav>
{/if}

<div class="mt-6 flex flex-col gap-6">
	{@render children()}
</div>
