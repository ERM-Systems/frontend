<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Search from '@lucide/svelte/icons/search';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import Toc from '$lib/components/settings/Toc.svelte';
	import {
		dashboardGroups,
		dashboardHref,
		dashboardPages,
		landingSlug,
		managementLevel,
		matchesPage,
		pageEntry
	} from '$lib/dashboard';
	import { guildData } from '$lib/dashboardData.svelte';
	import { toast } from '$lib/toast.svelte';
	import type { GuildAccess } from '$lib/server/dashboard';
	import type { Guild } from '$lib/server/guilds';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	$effect(() => {
		const incoming = data.roles;
		let active = true;

		incoming.then((value) => {
			if (active) guildData.roles = value;
		});

		return () => {
			active = false;
		};
	});

	$effect(() => {
		const incoming = data.channels;
		let active = true;

		incoming.then((value) => {
			if (active) guildData.channels = value;
		});

		return () => {
			active = false;
		};
	});

	let access = $state<GuildAccess | null>(null);

	$effect(() => {
		const incoming = data.access;
		let active = true;

		incoming.then((value) => {
			if (!active) return;

			access = value;
			guildData.locked = value.status !== 'ok';

			if (value.guild) {
				guildData.level = value.level;
				guildData.reviewer = value.reviewer;
			}
		});

		return () => {
			active = false;
		};
	});

	const guild = $derived(access?.guild ?? (data.guild.name ? data.guild : null));

	const canSetup = $derived(
		!!access && (access.level >= managementLevel || !!access.granted['dashboard.setup.view'])
	);

	$effect(() => {
		if (guild?.name) guildData.name = guild.name;
	});

	let guilds = $state<Guild[]>([]);

	$effect(() => {
		const incoming = data.guilds;
		let active = true;

		incoming.then((value) => {
			if (active) guilds = value ?? [];
		});

		return () => {
			active = false;
		};
	});

	let query = $state('');
	let searchField = $state<HTMLInputElement>();
	let refreshing = $state(false);

	let open = $state(false);
	let switcher = $state(false);
	let contentEl = $state<HTMLElement>();
	let switcherEl = $state<HTMLElement>();

	onMount(() => {
		query = '';
		if (searchField) searchField.value = '';
	});

	const term = $derived(query.trim().toLowerCase());
	const viewer = $derived({ level: guildData.level, reviewer: guildData.reviewer });
	const visible = $derived(
		dashboardPages.filter((entry) => matchesPage(entry, term) && pageEntry(entry, viewer))
	);

	const groups = $derived(
		dashboardGroups
			.map((group) => ({ group, pages: visible.filter((entry) => entry.group === group) }))
			.filter((entry) => entry.pages.length)
	);

	const segments = $derived(page.url.pathname.split('/'));
	const current = $derived(segments[3] ?? '');
	const focused = $derived(current === 'applications' && !!segments[4]);

	const target = $derived(navigating.to?.url.pathname.split('/')[3] ?? '');
	const loading = $derived(!!navigating.to && navigating.to.url.pathname !== page.url.pathname);

	const activeSlug = $derived(loading ? target : current);
	const active = $derived(dashboardPages.find((entry) => entry.slug === activeSlug));

	let slow = $state(false);

	$effect(() => {
		if (!loading) {
			slow = false;
			return;
		}

		const timer = setTimeout(() => (slow = true), 250);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		document.body.style.overflow = open ? 'hidden' : '';
	});

	const href = (slug: string) => dashboardHref(data.guild.id, slug);

	function switchHref(entry: Guild) {
		const access = { level: entry.permissionLevel, reviewer: entry.applicationAccess };
		const target = dashboardPages.find((item) => item.slug === current);

		return dashboardHref(entry.id, (target && pageEntry(target, access)) || landingSlug(access));
	}

	async function refresh() {
		if (refreshing) return;
		refreshing = true;

		const failure = 'Could not reload from Discord, try again shortly.';

		try {
			const response = await fetch(`/api/dashboard/${data.guild.id}/refresh`, { method: 'POST' });
			if (!response.ok) {
				const body = (await response.json().catch(() => ({}))) as { message?: unknown };
				toast(typeof body.message === 'string' && body.message ? body.message : failure, 'error');
				return;
			}

			await invalidateAll();
			toast('Server data resynced', 'success');
		} catch {
			toast(failure, 'error');
		} finally {
			refreshing = false;
		}
	}
</script>

<svelte:head
	><title>{active?.label ?? 'Dashboard'} - {guildData.name || 'ERM Systems'}</title></svelte:head
>

<svelte:window
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;
		switcher = false;
		open = false;
	}}
	onresize={() => {
		if (window.innerWidth >= 1024) open = false;
	}}
	onpointerdown={(event) => {
		if (switcher && switcherEl && !switcherEl.contains(event.target as Node)) switcher = false;
	}}
/>

{#snippet entries()}
	{#each groups as entry (entry.group)}
		<p class="px-3 pt-3 pb-1.5 text-[11px] tracking-wide text-muted uppercase">
			{entry.group}
		</p>

		{#each entry.pages as item (item.slug)}
			<a
				href={href(pageEntry(item, viewer) ?? item.slug)}
				onclick={() => (open = false)}
				aria-current={activeSlug === item.slug ? 'page' : undefined}
				class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors pointer-coarse:py-3 {activeSlug ===
				item.slug
					? 'bg-white/8 font-medium text-white'
					: 'text-muted hover:bg-white/5 hover:text-white'}"
			>
				<item.icon class="h-4 w-4 shrink-0" />
				{item.label}
			</a>
		{/each}
	{:else}
		<p class="px-3 py-6 text-center text-sm text-muted">No settings match "{query}".</p>
	{/each}
{/snippet}

<div
	class="mx-auto flex flex-col lg:flex-row {focused
		? 'max-w-none px-6 py-8'
		: 'max-w-400 gap-8 px-6 py-10'}"
>
	{#if !focused}
		<aside
			class="no-scrollbar w-full shrink-0 lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)] lg:w-64 lg:self-start lg:overflow-y-auto lg:overscroll-contain"
			in:fly={{ y: 10, duration: 260 }}
		>
			<div class="relative" bind:this={switcherEl}>
				<button
					type="button"
					onclick={() => (switcher = !switcher)}
					aria-haspopup="menu"
					aria-expanded={switcher}
					class="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:bg-white/5"
				>
					{#if !guild}
						<div class="skeleton h-9 w-9 shrink-0 rounded-lg bg-white/10"></div>
					{:else if guild.iconUrl}
						<img src={guild.iconUrl} alt="" class="h-9 w-9 shrink-0 rounded-lg object-cover" />
					{:else}
						<div
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-line text-xs font-semibold"
						>
							{guild.name.slice(0, 2).toUpperCase()}
						</div>
					{/if}

					<div class="min-w-0 flex-1">
						{#if guild}
							<p class="truncate text-sm font-semibold" in:fade={{ duration: 180 }}>{guild.name}</p>
						{:else}
							<div class="skeleton h-3.5 w-28 rounded bg-white/10"></div>
						{/if}
						<p class="mt-1 text-xs text-muted">Switch server</p>
					</div>

					<ChevronDown
						class="h-4 w-4 shrink-0 text-muted {switcher ? 'rotate-180' : ''} transition-transform"
					/>
				</button>

				{#if switcher}
					<div
						class="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
						role="menu"
						transition:fly={{ y: -6, duration: 150 }}
					>
						<div class="max-h-[min(20rem,60dvh)] overflow-y-auto py-1">
							{#each guilds as entry (entry.id)}
								<a
									href={switchHref(entry)}
									role="menuitem"
									onclick={() => (switcher = false)}
									aria-current={entry.id === data.guild.id ? 'true' : undefined}
									class="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-white/5 {entry.id ===
									data.guild.id
										? 'bg-white/5'
										: ''}"
								>
									{#if entry.iconUrl}
										<img
											src={entry.iconUrl}
											alt=""
											class="h-8 w-8 shrink-0 rounded-lg object-cover"
										/>
									{:else}
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-line text-[11px] font-semibold"
										>
											{entry.name.slice(0, 2).toUpperCase()}
										</div>
									{/if}

									<span
										class="min-w-0 flex-1 truncate text-sm {entry.id === data.guild.id
											? 'font-semibold text-white'
											: 'text-muted'}"
									>
										{entry.name}
									</span>

									{#if entry.id === data.guild.id}
										<Check class="h-4 w-4 shrink-0 text-muted" />
									{/if}
								</a>
							{:else}
								<div class="skeleton mx-3 my-2 h-8 rounded bg-white/10"></div>
							{/each}
						</div>

						<a
							href={resolve('/guilds')}
							onclick={() => (switcher = false)}
							class="flex items-center justify-center gap-2 border-t border-line px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:bg-white/5 hover:text-white"
						>
							All servers
						</a>
					</div>
				{/if}
			</div>

			<div class="mt-3 flex gap-2">
				<div class="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
					<Search class="h-4 w-4 shrink-0 text-muted" />
					<input
						bind:this={searchField}
						bind:value={query}
						autocomplete="off"
						placeholder="Search settings"
						aria-label="Search settings"
						class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
					/>
				</div>

				<button
					type="button"
					onclick={refresh}
					disabled={refreshing}
					aria-label="Resync Discord data"
					title="Reload from Discord"
					class="flex shrink-0 items-center rounded-lg border border-line bg-surface px-3 text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:px-3.5"
				>
					<RefreshCw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" />
				</button>
			</div>

			<button
				type="button"
				onclick={() => (open = !open)}
				aria-expanded={open}
				class="mt-3 flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm lg:hidden pointer-coarse:py-3"
			>
				{#if active}
					{@const Icon = active.icon}
					<Icon class="h-4 w-4 shrink-0 text-muted" />
				{/if}
				<span class="flex-1 text-left font-medium">{active?.label ?? 'Settings'}</span>
				<ChevronDown class="h-4 w-4 text-muted {open ? 'rotate-180' : ''} transition-transform" />
			</button>

			<nav class="mt-3 hidden lg:block">{@render entries()}</nav>
		</aside>
	{/if}

	<div class="relative min-w-0 flex-1 pb-20" bind:this={contentEl}>
		{#if access && access.status !== 'ok'}
			<div class="rounded-xl border border-line bg-surface p-10 text-center" in:fade>
				<div
					class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
				>
					<ShieldAlert class="h-5 w-5 text-yellow-400" />
				</div>

				<h2 class="mt-4 text-lg font-semibold">
					{#if access.status === 'denied'}
						Management access only
					{:else if access.status === 'missing'}
						You are not in that server
					{:else}
						Your servers are unavailable
					{/if}
				</h2>

				<p class="mx-auto mt-2 max-w-96 text-sm text-muted">
					{#if access.status === 'denied'}
						{access.guild?.name || 'That server'} needs a management role before you can change its settings.
					{:else if access.status === 'missing'}
						Either you left it, or ERM is no longer in it.
					{:else}
						Discord did not answer in time. Reload in a moment.
					{/if}
				</p>

				<a
					href={resolve('/guilds')}
					class="mt-6 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
				>
					Back to your servers
				</a>
			</div>
		{:else}
			{#if data.setupPending && canSetup && !page.url.pathname.endsWith('/dashboard/setup')}
				<a
					href={resolve(`/${data.guild.id}/dashboard/setup`)}
					class="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-yellow-400/25 bg-yellow-400/10 px-4 py-3 text-sm transition-colors hover:bg-yellow-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
				>
					<span class="font-medium text-yellow-300">ERM is not set up yet.</span>
					<span class="text-muted">Pick your staff roles so your team can start using it.</span>
					<span class="ml-auto font-semibold text-yellow-300">Finish setup</span>
				</a>
			{/if}

			{#key data.guild.id + current}
				<div in:fade={{ duration: 200 }}>
					{@render children()}
				</div>
			{/key}

			{#if slow}
				<div
					class="absolute inset-0 z-30 flex items-start justify-center rounded-xl bg-bg/50 pt-28 backdrop-blur-sm"
					transition:fade={{ duration: 150 }}
				>
					<div
						class="flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted shadow-2xl shadow-black/40"
					>
						<LoaderCircle class="h-4 w-4 animate-spin" />
						Loading {active?.label ?? 'page'}…
					</div>
				</div>
			{/if}
		{/if}
	</div>

	{#if !focused}
		<Toc container={contentEl} />
	{/if}
</div>

{#if open}
	<div
		class="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm lg:hidden"
		role="presentation"
		onclick={() => (open = false)}
		transition:fade={{ duration: 150 }}
	></div>

	<nav
		class="pwa-drawer fixed top-0 left-0 z-70 h-dvh w-72 max-w-[85vw] overflow-y-auto overscroll-contain border-r border-line bg-surface p-3 shadow-2xl shadow-black/60 lg:hidden"
		transition:fly={{ x: -320, duration: 250, opacity: 1 }}
	>
		{@render entries()}
	</nav>
{/if}
