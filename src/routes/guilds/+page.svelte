<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Move from '@lucide/svelte/icons/move';
	import Pin from '@lucide/svelte/icons/pin';
	import PinOff from '@lucide/svelte/icons/pin-off';
	import Plus from '@lucide/svelte/icons/plus';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { onMount, untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import Meta from '$lib/components/Meta.svelte';
	import { administratorLevel, landingSlug } from '$lib/dashboard';
	import { guildCache, readOrder, writeOrder } from '$lib/guilds.svelte';
	import { toast } from '$lib/toast.svelte';
	import { utm } from '$lib/utm';
	import type { PageData } from './$types';

	type Guild = NonNullable<Awaited<PageData['guilds']>>[number];

	let { data }: { data: PageData } = $props();

	let refreshing = $state(false);
	let cooldown = $state(untrack(() => Math.ceil(data.wait / 1000)));

	$effect(() => {
		if (!cooldown) return;
		const timer = setInterval(() => (cooldown = Math.max(0, cooldown - 1)), 1000);
		return () => clearInterval(timer);
	});

	let order = $state<string[]>([]);

	onMount(() => {
		order = readOrder();
	});

	$effect(() => {
		const incoming = data.guilds;
		let active = true;

		incoming.then((value) => {
			if (!active) return;
			guildCache.list = value;
		});

		return () => {
			active = false;
		};
	});

	const loading = $derived(guildCache.list === undefined);
	const list = $derived(guildCache.list ?? []);
	const placeholders = Array.from({ length: 8 }, (_, index) => index);

	let arranging = $state(false);
	let draft = $state<string[]>([]);
	let saved = $state<string[]>([]);
	let dragging = $state<string | null>(null);
	let leaving = $state<URL | null>(null);

	const activeOrder = $derived(arranging ? draft : order);

	const ordered = $derived(
		[...list].sort((a, b) => {
			if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

			const left = activeOrder.indexOf(a.id);
			const right = activeOrder.indexOf(b.id);

			if (left !== -1 || right !== -1) {
				if (left === -1) return 1;
				if (right === -1) return -1;
				return left - right;
			}

			return a.name.localeCompare(b.name);
		})
	);

	const dirty = $derived(arranging && draft.join() !== saved.join());

	function startArranging() {
		draft = ordered.map((guild) => guild.id);
		saved = [...draft];
		arranging = true;
		menu = null;
	}

	function swappable(guild: Guild): boolean {
		if (!dragging || dragging === guild.id) return false;
		return list.find((entry) => entry.id === dragging)?.pinned === guild.pinned;
	}

	function dragOver(guild: Guild) {
		if (!dragging || !swappable(guild)) return;

		const ids = [...draft];
		const from = ids.indexOf(dragging);
		const to = ids.indexOf(guild.id);
		if (from === -1 || to === -1) return;

		ids.splice(to, 0, ...ids.splice(from, 1));
		draft = ids;
	}

	function save() {
		order = [...draft];
		writeOrder(order);
		arranging = false;
		dragging = null;
		depart();
	}

	function resetOrder() {
		draft = [...list]
			.sort((a, b) => {
				if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
				return a.name.localeCompare(b.name);
			})
			.map((guild) => guild.id);
	}

	function discard() {
		arranging = false;
		dragging = null;
		depart();
	}

	function depart() {
		const target = leaving;
		leaving = null;
		if (target) goto(`${target.pathname}${target.search}${target.hash}` as ResolvedPathname);
	}

	let affiliates = $state(new Set<string>());

	$effect(() => {
		data.affiliates.then((value) => (affiliates = new Set(value)));
	});

	const official = new Set(['987798554972143728']);

	const roles: Record<number, string> = {
		3: 'Management',
		2: 'Administrator',
		1: 'Moderator'
	};

	function role(guild: Guild): string {
		return (
			roles[guild.permissionLevel] ?? (guild.applicationAccess ? 'Application Reviewer' : 'Member')
		);
	}

	function panel(guild: Guild): ResolvedPathname {
		return `/${guild.id}/panel` as ResolvedPathname;
	}

	function overview(guild: Guild): ResolvedPathname {
		return `/${guild.id}/server` as ResolvedPathname;
	}

	function dashboard(guild: Guild): ResolvedPathname | null {
		const access = { level: guild.permissionLevel, reviewer: guild.applicationAccess };
		if (access.level < administratorLevel && !access.reviewer) return null;

		return `/${guild.id}/dashboard/${landingSlug(access)}` as ResolvedPathname;
	}

	let menu = $state<{ guild: Guild; x: number; y: number } | null>(null);
	let innerWidth = $state(0);
	let innerHeight = $state(0);

	const menuWidth = 176;
	const menuHeight = 84;

	beforeNavigate((navigation) => {
		if (!dirty || !navigation.to) return;

		navigation.cancel();
		leaving = navigation.to.url;
	});

	function openMenu(event: MouseEvent, guild: Guild) {
		event.preventDefault();
		menu = {
			guild,
			x: Math.min(event.clientX, innerWidth - menuWidth - 8),
			y: Math.min(event.clientY, innerHeight - menuHeight - 8)
		};
	}
</script>

<svelte:window
	bind:innerWidth
	bind:innerHeight
	onscroll={() => (menu = null)}
	onkeydown={(event) => event.key === 'Escape' && (menu = null)}
	onbeforeunload={(event) => dirty && event.preventDefault()}
/>

<Meta
	title="Your Servers - ERM Systems"
	description="Open the ERM dashboard for any Discord server you manage."
/>

<section class="mx-auto max-w-350 px-6 py-16">
	<div class="flex flex-wrap items-center gap-4">
		<div>
			<h1 class="text-4xl font-bold tracking-[-0.03em]">Your Servers</h1>
			<p class="mt-3 text-muted">
				Signed in as {#await data.username}<span class="skeleton rounded">your account</span
					>{:then username}{username}{/await}. Choose a server to work in today.
			</p>
		</div>

		<div class="ml-auto flex items-center gap-2">
			<form
				method="POST"
				action="?/refresh"
				use:enhance={() => {
					refreshing = true;
					guildCache.list = undefined;

					return async ({ result, update }) => {
						refreshing = false;
						const wait = Number((result as { data?: { wait?: number } }).data?.wait ?? 0);
						cooldown = Math.ceil(wait / 1000);

						if (result.type === 'failure') {
							toast(String(result.data?.message ?? 'Refresh failed.'), 'error');
							guildCache.list = await data.guilds;
							return;
						}

						await update({ reset: false });
						toast('Server list updated.', 'success');
					};
				}}
			>
				<button
					type="submit"
					disabled={refreshing || cooldown > 0}
					class="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-surface pointer-coarse:py-3"
				>
					<RefreshCw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" />
					{cooldown ? `Refresh (${cooldown}s)` : 'Refresh'}
				</button>
			</form>

			<a
				href={utm(resolve('/invite'), 'guilds-header') as ResolvedPathname}
				data-sveltekit-reload
				class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Add server
			</a>
		</div>
	</div>

	{#if loading}
		<div class="relative mt-10">
			<div
				class="absolute inset-0 z-10 flex items-start justify-center pt-16"
				transition:fade={{ duration: 120 }}
			>
				<span
					class="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-muted shadow-2xl shadow-black/60"
				>
					<LoaderCircle class="h-4 w-4 animate-spin" />
					Loading your servers
				</span>
			</div>

			<div
				class="pointer-events-none grid gap-4 blur-[3px] select-none sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
			>
				{#each placeholders as index (index)}
					<div class="skeleton overflow-hidden rounded-xl border border-line bg-surface">
						<div class="h-24 bg-white/5"></div>
						<div class="-mt-8 px-5 pb-5">
							<div class="h-14 w-14 rounded-xl bg-white/10 ring-4 ring-surface"></div>
							<div class="mt-3 h-4 w-3/5 rounded bg-white/10"></div>
							<div class="mt-2 h-3 w-2/5 rounded bg-white/8"></div>
							<div class="mt-5 h-9 rounded-lg bg-white/8"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if guildCache.list === null}
		<p class="mt-10 rounded-xl border border-line bg-surface p-6 text-muted">
			Your servers are unavailable right now. Try refreshing in a moment.
		</p>
	{:else if !list.length}
		<div class="mt-10 rounded-xl border border-line bg-surface p-10 text-center">
			<h2 class="text-xl font-semibold">No servers yet</h2>
			<p class="mt-2 text-muted">You do not have access to any server using ERM.</p>
			<a
				href={utm(resolve('/invite'), 'guilds-empty') as ResolvedPathname}
				data-sveltekit-reload
				class="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Invite ERM
			</a>
		</div>
	{:else}
		<div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each ordered as guild (guild.id)}
				{@const dashboardHref = dashboard(guild)}
				<article
					draggable={arranging}
					oncontextmenu={(event) => openMenu(event, guild)}
					ondragstart={(event) => {
						dragging = guild.id;
						event.dataTransfer?.setData('text/plain', guild.id);
					}}
					ondragend={() => (dragging = null)}
					ondragover={(event) => {
						if (!arranging || !swappable(guild)) return;
						event.preventDefault();
						dragOver(guild);
					}}
					class="relative flex flex-col overflow-hidden rounded-xl border bg-surface transition-colors {guild.pinned
						? 'border-white/20'
						: 'border-line'} {arranging
						? 'cursor-grab select-none active:cursor-grabbing'
						: 'hover:border-white/20'} {dragging === guild.id ? 'opacity-40' : ''}"
				>
					{#if guild.overviewEnabled && !arranging}
						<a
							href={overview(guild)}
							aria-label="Open {guild.name} overview"
							class="absolute inset-0 z-10"
						></a>
					{/if}

					<div class="relative h-24 bg-white/4">
						{#if guild.bannerUrl}
							<img
								src={guild.bannerUrl}
								alt=""
								loading="lazy"
								decoding="async"
								class="h-full w-full object-cover"
							/>
							<div class="absolute inset-0 bg-linear-to-t from-surface to-transparent"></div>
						{/if}

						{#if guild.pinned}
							<span
								class="absolute top-2 right-2 rounded-full bg-bg/70 p-1.5 backdrop-blur-sm"
								title="Pinned"
							>
								<Pin class="h-3.5 w-3.5" />
							</span>
						{/if}
					</div>

					<div class="relative -mt-8 flex flex-1 flex-col px-5 pb-5">
						{#if guild.iconUrl}
							<img
								src={guild.iconUrl}
								alt=""
								loading="lazy"
								decoding="async"
								class="h-14 w-14 rounded-xl bg-surface object-cover ring-4 ring-surface"
							/>
						{:else}
							<div
								class="flex h-14 w-14 items-center justify-center rounded-xl bg-line text-lg font-semibold ring-4 ring-surface"
							>
								{guild.name.slice(0, 2).toUpperCase()}
							</div>
						{/if}

						<div class="mt-3 flex flex-wrap items-center gap-2">
							<h2 class="truncate font-semibold">{guild.name}</h2>
							{#if official.has(guild.id)}
								<span
									class="rounded-full border border-[#5799ef]/25 bg-[#5799ef]/10 px-2 py-0.5 text-[11px] font-semibold text-[#5799ef]"
								>
									Official
								</span>
							{:else if affiliates.has(guild.id)}
								<span
									class="rounded-full border border-[#db514d]/25 bg-[#db514d]/10 px-2 py-0.5 text-[11px] font-semibold text-[#db514d]"
								>
									Affiliate
								</span>
							{/if}
						</div>

						<p class="mt-1 text-sm text-muted">{role(guild)}</p>

						<div
							class="relative z-20 mt-5 flex gap-2 {arranging
								? 'pointer-events-none opacity-50'
								: ''}"
						>
							{#if guild.permissionLevel >= 1}
								<a
									href={panel(guild)}
									class="flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 text-center text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
								>
									Panel
								</a>
							{/if}
							{#if dashboardHref}
								<a
									href={dashboardHref}
									class="flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 text-center text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
								>
									Dashboard
								</a>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

{#if menu}
	{@const target = menu.guild}
	<div
		class="fixed inset-0 z-60"
		role="presentation"
		onpointerdown={() => (menu = null)}
		oncontextmenu={(event) => {
			event.preventDefault();
			menu = null;
		}}
	></div>

	<div
		class="fixed z-70 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-2xl shadow-black/60"
		style="left: {menu.x}px; top: {menu.y}px"
		role="menu"
		transition:fly={{ y: -4, duration: 120 }}
	>
		<p class="truncate border-b border-line px-3 py-2 text-xs text-muted">{target.name}</p>

		<form
			method="POST"
			action="?/pin"
			use:enhance={() => {
				menu = null;
				return async ({ result }) => {
					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not update the pin.'), 'error');
						return;
					}

					target.pinned = Boolean((result as { data?: { pinned?: boolean } }).data?.pinned);
					toast(target.pinned ? 'Server pinned.' : 'Server unpinned.', 'success');
				};
			}}
		>
			<input type="hidden" name="id" value={target.id} />
			<button
				type="submit"
				role="menuitem"
				class="flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-white/5"
			>
				{#if target.pinned}
					<PinOff class="h-4 w-4 text-muted" />
					Unpin server
				{:else}
					<Pin class="h-4 w-4 text-muted" />
					Pin server
				{/if}
			</button>
		</form>

		<button
			type="button"
			role="menuitem"
			onclick={startArranging}
			class="flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-white/5"
		>
			<Move class="h-4 w-4 text-muted" />
			Move servers
		</button>
	</div>
{/if}

{#if arranging}
	<div
		class="fixed bottom-6 left-1/2 z-60 flex -translate-x-1/2 items-center rounded-full border border-line bg-surface p-1.5 shadow-2xl shadow-black/60"
		transition:fly={{ y: 12, duration: 180 }}
	>
		<span class="pr-3 pl-4 text-sm text-muted">Drag a server to reorder</span>

		<button
			type="button"
			onclick={resetOrder}
			class="rounded-full px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
		>
			Reset
		</button>

		<button
			type="button"
			onclick={discard}
			class="rounded-full px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
		>
			Discard
		</button>

		<button
			type="button"
			onclick={save}
			class="ml-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85"
		>
			Save
		</button>
	</div>
{/if}

{#if leaving}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">Unsaved order</h2>
		<p class="mt-2 text-sm text-muted">
			You rearranged your servers but have not saved yet. What do you want to do?
		</p>

		<div class="mt-6 flex gap-2">
			<button
				type="button"
				onclick={discard}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Discard
			</button>
			<button
				type="button"
				onclick={save}
				class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				Save
			</button>
		</div>
	</div>
{/if}
