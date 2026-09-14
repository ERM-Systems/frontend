<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CloudCog from '@lucide/svelte/icons/cloud-cog';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Menu from '@lucide/svelte/icons/menu';
	import Search from '@lucide/svelte/icons/search';
	import Settings from '@lucide/svelte/icons/settings';
	import X from '@lucide/svelte/icons/x';
	import { fade, fly } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { page } from '$app/state';
	import avatar from '$lib/assets/fallback-0.png';
	import NotificationsMenu from '$lib/components/NotificationsMenu.svelte';
	import { health } from '$lib/health.svelte';
	import { loadNavbar, navbar } from '$lib/navbar.svelte';
	import { loadTheme } from '$lib/theme.svelte';
	import { defaultAvatar } from '$lib/staff';
	import type { Group, State, Status } from '$lib/server/status';

	const { onsearch }: { onsearch: () => void } = $props();

	const links: { label: string; href: ResolvedPathname }[] = [
		{ label: 'Dashboard', href: resolve('/guilds') },
		{ label: 'Features', href: resolve('/features') },
		{ label: 'Whitelabel', href: resolve('/whitelabel') }
	];

	const current = $derived(page.url.pathname);

	function active(href: string): boolean {
		if (!href.startsWith('/')) return false;
		return current === href || current.startsWith(`${href}/`);
	}

	onMount(loadNavbar);
	onMount(loadTheme);

	let scrollY = $state(0);
	const scrolled = $derived(scrollY > 24);

	let open = $state(false);
	let menu = $state(false);
	let account = $state<HTMLElement>();

	$effect(() => {
		document.body.style.overflow = open ? 'hidden' : '';
	});

	const signedIn = $derived(page.data.signedIn as boolean);

	let user = $state<{ id: string; username: string; avatarUrl: string } | null>(null);

	$effect(() => {
		const incoming = Promise.resolve(
			page.data.user as { id: string; username: string; avatarUrl: string } | null
		);
		let active = true;

		incoming.then((value) => active && (user = value));

		return () => {
			active = false;
		};
	});

	const pending: Group = { up: 0, total: 0, state: 'unknown' };

	const onPanel = $derived(/^\/\d{17,20}\/panel(\/|$)/.test(current));

	const wide = $derived(/^\/\d{17,20}\/dashboard(\/|$)/.test(current));

	$effect(() => {
		if (signedIn && onPanel) return health.watch();
	});

	const edge = $derived(
		!signedIn || !onPanel
			? 'border-line/80'
			: health.online && health.streaming
				? 'border-green-500/80'
				: 'border-red-500/90'
	);

	let status = $state<Status | null>(null);

	$effect(() => {
		const incoming = Promise.resolve(page.data.status as Status);
		let active = true;
		incoming.then((value) => active && (status = value));
		return () => {
			active = false;
		};
	});

	const loading = $derived(!status);
	const shards = $derived(status?.shards ?? pending);
	const services = $derived(status?.services ?? pending);

	const groups = $derived([
		{ label: 'Shards', group: shards, href: resolve('/status') },
		{ label: 'Services', group: services, href: resolve('/status/redirect') }
	]);

	const overall = $derived.by((): State => {
		const states = [shards.state, services.state];
		if (states.includes('down')) return 'down';
		if (states.includes('degraded')) return 'degraded';
		if (states.every((state) => state === 'operational')) return 'operational';
		return 'unknown';
	});

	const dot: Record<State, string> = {
		operational: 'bg-green-500',
		degraded: 'bg-yellow-500',
		down: 'bg-red-500',
		unknown: 'bg-red-500'
	};

	const label: Record<State, string> = {
		operational: 'All systems operational',
		degraded: 'Partially degraded',
		down: 'Outage detected',
		unknown: 'Major outage'
	};

	const statusLabel = $derived(loading ? 'Checking service status' : label[overall]);

	function shade(state: State): string {
		return loading ? 'bg-white/25' : dot[state];
	}
	onMount(loadTheme);

	const shell = $derived(
		navbar.floating
			? `mt-3 rounded-full ${
					scrolled
						? 'max-w-270 border-line px-5 shadow-xl shadow-black/50'
						: `${wide ? 'max-w-400' : 'max-w-350'} ${edge} px-6`
				}`
			: `rounded-b-xl border-t-0 px-6 ${wide ? 'max-w-400' : 'max-w-350'} ${edge}`
	);
</script>

<svelte:window
	bind:scrollY
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;
		open = false;
		menu = false;
	}}
	onresize={() => {
		if (window.innerWidth >= 768) open = false;
	}}
	onpointerdown={(event) => {
		if (menu && account && !account.contains(event.target as Node)) menu = false;
	}}
/>

<header
	class="pwa-safe-header pointer-events-none fixed inset-x-0 top-0 z-50 px-4 transition-colors duration-300 ease-out {scrolled
		? 'bg-bg'
		: ''}"
>
	<div
		class="pointer-events-auto mx-auto flex h-14 items-center gap-4 border bg-bg/40 backdrop-blur-xl transition-[max-width,padding,border-color,box-shadow] duration-300 ease-out pointer-coarse:bg-bg pointer-coarse:backdrop-blur-none {shell}"
	>
		<a href={resolve('/')} class="tap shrink-0" aria-label="ERM Systems">
			<img src="/branding/ERMred.svg" alt="ERM" class="h-6 w-6" />
		</a>

		<span class="hidden h-5 w-px bg-white/12 md:block"></span>

		<nav class="hidden items-center gap-1 md:flex">
			{#each links as link (link.label)}
				<a
					href={link.href}
					aria-current={active(link.href) ? 'page' : undefined}
					class="rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3 {active(
						link.href
					)
						? 'text-white underline decoration-white/40 underline-offset-4'
						: 'text-muted'}"
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="ml-auto flex items-center gap-1 pointer-coarse:gap-2">
			<div class="group relative hidden md:block">
				<a
					href={resolve('/status')}
					aria-label="Service status: {statusLabel}"
					class="tap relative block rounded-md p-2 text-muted transition-colors hover:bg-white/5 hover:text-white"
				>
					<CloudCog class="h-4.5 w-4.5" />
					<span
						class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ring-bg {shade(
							overall
						)} {loading ? 'animate-pulse' : ''}"
					></span>
				</a>

				<div
					class="invisible absolute top-full right-0 z-50 mt-2 w-64 translate-y-1 rounded-xl border border-line bg-surface opacity-0 shadow-2xl shadow-black/60 transition-all duration-150 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
				>
					<p class="border-b border-line px-4 py-2.5 text-xs text-muted">{statusLabel}</p>

					<ul class="divide-y divide-line/60">
						{#each groups as row (row.label)}
							<li>
								<a
									href={row.href}
									class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
								>
									<span
										class="h-2 w-2 shrink-0 rounded-full {shade(row.group.state)} {loading
											? 'animate-pulse'
											: ''}"
									></span>
									<span class="flex-1 text-sm font-medium">{row.label}</span>
									{#if loading}
										<span class="skeleton text-xs text-muted">00/00</span>
									{:else}
										<span class="text-xs text-muted">
											{row.group.total ? `${row.group.up}/${row.group.total}` : 'N/A'}
										</span>
									{/if}
									<ChevronRight class="h-4 w-4 text-muted" />
								</a>
							</li>
						{/each}
					</ul>
				</div>
			</div>

			{#if signedIn}
				<NotificationsMenu />
			{/if}

			<span class="mx-2 hidden h-5 w-px bg-white/12 md:block"></span>

			{#if signedIn}
				<div class="relative hidden md:block" bind:this={account}>
					<button
						type="button"
						onclick={() => (menu = !menu)}
						disabled={!user}
						aria-label="Account menu"
						aria-haspopup="menu"
						aria-expanded={menu}
						class="tap block rounded-full ring-1 ring-white/10 transition-shadow hover:ring-white/25"
					>
						{#if user}
							{@const userId = user.id}
							<img
								src={user.avatarUrl}
								alt=""
								onerror={(event) => {
									const image = event.currentTarget as HTMLImageElement;
									const fallback = defaultAvatar(userId);
									if (image.src !== fallback) image.src = fallback;
								}}
								class="h-7 w-7 rounded-full"
							/>
						{:else}
							<span class="skeleton block h-7 w-7 rounded-full bg-white/12"></span>
						{/if}
					</button>

					{#if menu && user}
						<div
							class="absolute top-full right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
							role="menu"
							transition:fly={{ y: -6, duration: 150 }}
						>
							<p class="truncate border-b border-line px-4 py-2.5 text-xs text-muted">
								{user.username}
							</p>

							<a
								href={resolve('/settings')}
								role="menuitem"
								onclick={() => (menu = false)}
								class="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/5"
							>
								<Settings class="h-4 w-4 text-muted" />
								Settings
							</a>

							<a
								href={resolve('/billing')}
								role="menuitem"
								onclick={() => (menu = false)}
								class="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/5"
							>
								<CreditCard class="h-4 w-4 text-muted" />
								Billing
							</a>

							<form method="POST" action="/logout" class="border-t border-line">
								<button
									type="submit"
									role="menuitem"
									class="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/5"
								>
									<LogOut class="h-4 w-4 text-muted" />
									Log out
								</button>
							</form>
						</div>
					{/if}
				</div>
			{:else}
				<a
					href={resolve('/login')}
					data-sveltekit-reload
					aria-label="Continue with Discord"
					class="tap hidden rounded-full ring-1 ring-white/10 transition-shadow hover:ring-white/25 md:block"
				>
					<img src={avatar} alt="" class="h-7 w-7 rounded-full" />
				</a>
			{/if}

			<button
				type="button"
				onclick={() => (open = true)}
				aria-label="Open menu"
				aria-expanded={open}
				class="rounded-md p-2 text-muted transition-colors hover:bg-white/5 hover:text-white md:hidden pointer-coarse:p-3"
			>
				<Menu class="h-5 w-5" />
			</button>
		</div>
	</div>
</header>

{#if open}
	<div
		class="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm md:hidden"
		transition:fade={{ duration: 150 }}
		onclick={() => (open = false)}
		role="presentation"
	></div>

	<aside
		class="pwa-drawer fixed top-0 right-0 z-70 flex h-dvh w-72 max-w-[85vw] flex-col overscroll-contain border-l border-line bg-surface md:hidden"
		transition:fly={{ x: 320, duration: 250, opacity: 1 }}
	>
		<div class="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
			<img src="/branding/ERMred.svg" alt="ERM" class="h-6 w-6" />
			<button
				type="button"
				onclick={() => (open = false)}
				aria-label="Close menu"
				class="tap rounded-md p-2 text-muted transition-colors hover:bg-white/5 hover:text-white"
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
			<nav class="flex flex-1 flex-col gap-1 p-3">
				<button
					type="button"
					onclick={() => {
						open = false;
						onsearch();
					}}
					class="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-white"
				>
					<Search class="h-4 w-4" />
					Search
				</button>

				{#each links as link (link.label)}
					<a
						href={link.href}
						onclick={() => (open = false)}
						aria-current={active(link.href) ? 'page' : undefined}
						class="rounded-lg px-3 py-2.5 text-center text-sm transition-colors hover:bg-white/5 hover:text-white {active(
							link.href
						)
							? 'bg-white/5 text-white'
							: 'text-muted'}"
					>
						{link.label}
					</a>
				{/each}
			</nav>

			<div class="shrink-0 border-t border-line">
				<p class="px-4 pt-3 pb-1 text-center text-xs text-muted">{statusLabel}</p>

				{#each groups as row (row.label)}
					<a
						href={row.href}
						onclick={() => (open = false)}
						class="flex items-center justify-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
					>
						<span
							class="h-2 w-2 shrink-0 rounded-full {shade(row.group.state)} {loading
								? 'animate-pulse'
								: ''}"
						></span>
						<span class="text-sm font-medium">{row.label}</span>
						{#if loading}
							<span class="skeleton text-xs text-muted">00/00</span>
						{:else}
							<span class="text-xs text-muted">
								{row.group.total ? `${row.group.up}/${row.group.total}` : 'N/A'}
							</span>
						{/if}
						<ChevronRight class="h-4 w-4 text-muted" />
					</a>
				{/each}

				{#if signedIn}
					<div class="m-3 flex flex-col gap-1 rounded-lg bg-white/5 p-1">
						<div class="flex items-center gap-3 px-2 py-2">
							{#if user}
								{@const userId = user.id}
								<img
									src={user.avatarUrl}
									alt=""
									onerror={(event) => {
										const image = event.currentTarget as HTMLImageElement;
										const fallback = defaultAvatar(userId);
										if (image.src !== fallback) image.src = fallback;
									}}
									class="h-7 w-7 rounded-full"
								/>
								<span class="truncate text-sm font-medium">{user.username}</span>
							{:else}
								<span class="skeleton block h-7 w-7 shrink-0 rounded-full bg-white/12"></span>
								<span class="skeleton h-4 w-28 rounded bg-white/12"></span>
							{/if}
						</div>

						<a
							href={resolve('/settings')}
							onclick={() => (open = false)}
							class="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-white/5"
						>
							<Settings class="h-4 w-4 text-muted" />
							Settings
						</a>

						<a
							href={resolve('/billing')}
							onclick={() => (open = false)}
							class="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-white/5"
						>
							<CreditCard class="h-4 w-4 text-muted" />
							Billing
						</a>

						<form method="POST" action="/logout">
							<button
								type="submit"
								class="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-white/5"
							>
								<LogOut class="h-4 w-4 text-muted" />
								Log out
							</button>
						</form>
					</div>
				{:else}
					<a
						href={resolve('/login')}
						data-sveltekit-reload
						onclick={() => (open = false)}
						class="m-3 flex items-center justify-center gap-3 rounded-lg bg-white/5 px-3 py-2.5 transition-colors hover:bg-white/10"
					>
						<img src={avatar} alt="" class="h-7 w-7 rounded-full" />
						<span class="text-sm font-medium">Continue with Discord</span>
					</a>
				{/if}
			</div>
		</div>
	</aside>
{/if}
