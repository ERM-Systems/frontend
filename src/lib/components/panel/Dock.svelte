<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Compass from '@lucide/svelte/icons/compass';
	import Eye from '@lucide/svelte/icons/eye';
	import Gauge from '@lucide/svelte/icons/gauge';
	import LifeBuoy from '@lucide/svelte/icons/life-buoy';
	import Megaphone from '@lucide/svelte/icons/megaphone';
	import Plane from '@lucide/svelte/icons/plane';
	import Scale from '@lucide/svelte/icons/scale';
	import Search from '@lucide/svelte/icons/search';
	import Siren from '@lucide/svelte/icons/siren';
	import X from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ResolvedPathname } from '$app/types';
	import Announcements from '$lib/components/panel/Announcements.svelte';
	import Bolos from '$lib/components/panel/Bolos.svelte';
	import Docs from '$lib/components/panel/Docs.svelte';
	import Priorities from '$lib/components/panel/Priorities.svelte';
	import Requests from '$lib/components/panel/Requests.svelte';
	import type { Panel } from '$lib/panelClient.svelte';
	import type { Documentation } from '$lib/server/panel';

	let {
		panel,
		now,
		documentation
	}: {
		panel: Panel;
		now: number;
		documentation: Documentation[];
	} = $props();

	interface Jump {
		label: string;
		hint: string;
		icon: typeof Siren;
		run: () => void;
	}

	let open = $state('');
	let query = $state('');
	let index = $state(0);
	let search = $state<HTMLInputElement>();

	const paneHints: Record<string, string> = {
		priorities: 'Handle urgent matters',
		requests: 'View staff assistance requests',
		bolos: 'Players to look out for',
		docs: 'Access documentation resources',
		announcements: 'Send global announcements'
	};

	const panes = $derived([
		{
			id: 'priorities',
			label: 'Priority Requests',
			icon: Siren,
			count: panel.snapshot.priorities.length
		},
		{ id: 'requests', label: 'Staff Requests', icon: LifeBuoy, count: panel.openRequests },
		{ id: 'bolos', label: 'BOLOs', icon: Eye, count: 0 },
		{ id: 'docs', label: 'Documentation', icon: BookOpen, count: 0 },
		...(panel.management
			? [
					{
						id: 'announcements',
						label: 'Announcements',
						icon: Megaphone,
						count: panel.announcements.length
					}
				]
			: [])
	]);

	$effect(() => {
		const pane = page.url.searchParams.get('dock');
		if (pane && panes.some((item) => item.id === pane)) open = pane;
	});

	const active = $derived(panes.find((item) => item.id === open));

	const waiting = $derived(panel.snapshot.priorities.length + panel.openRequests > 0);

	function leave(path: ResolvedPathname) {
		open = '';
		void goto(path);
	}

	const jumps = $derived.by(() => {
		const list: Jump[] = panes.map((item) => ({
			label: item.label,
			hint: paneHints[item.id] ?? '',
			icon: item.icon,
			run: () => (open = item.id)
		}));

		list.push(
			{
				label: 'Manage LOA',
				hint: 'Request and review leave',
				icon: Plane,
				run: () => leave(resolve(`/${panel.guildId}/panel/loa`))
			},
			{
				label: 'Infractions',
				hint: 'Staff infractions and promotions',
				icon: Scale,
				run: () => leave(resolve(`/${panel.guildId}/panel/infractions`))
			}
		);

		if (panel.management) {
			list.push({
				label: 'Dashboard',
				hint: 'Server settings and overview',
				icon: Gauge,
				run: () => leave(resolve(`/${panel.guildId}/dashboard/basic`))
			});
		}

		return list;
	});

	const matches = $derived.by(() => {
		const term = query.trim().toLowerCase();
		if (!term) return jumps;

		return jumps.filter((jump) => jump.label.toLowerCase().includes(term));
	});

	function show(id: string) {
		open = id;
		query = '';
		index = 0;
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			index = matches.length ? (index + 1) % matches.length : 0;
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			index = matches.length ? (index - 1 + matches.length) % matches.length : 0;
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			matches[index]?.run();
		}
	}

	$effect(() => {
		if (open === 'jump') search?.focus();
	});

	const offsetKey = 'panelDockOffset';
	const minOffset = 6;
	const maxOffset = 94;

	let offset = $state(50);
	let dragging = $state(false);
	let moved = false;

	onMount(() => {
		try {
			const saved = Number(localStorage.getItem(offsetKey));
			if (Number.isFinite(saved) && saved >= minOffset && saved <= maxOffset) offset = saved;
		} catch {
			offset = 50;
		}
	});

	function grab(event: PointerEvent) {
		moved = false;
		dragging = true;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function slide(event: PointerEvent) {
		if (!dragging) return;

		moved = true;
		const position = (event.clientY / window.innerHeight) * 100;
		offset = Math.min(maxOffset, Math.max(minOffset, position));
	}

	function release(event: PointerEvent) {
		if (!dragging) return;

		dragging = false;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);

		try {
			localStorage.setItem(offsetKey, String(Math.round(offset)));
		} catch {
			return;
		}
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (open = '')} />

{#if !open}
	<button
		type="button"
		onclick={() => !moved && show('jump')}
		onpointerdown={grab}
		onpointermove={slide}
		onpointerup={release}
		onpointercancel={release}
		aria-label="Open panel tools, drag to move"
		style="top: {offset}%"
		class="group fixed right-0 z-40 flex h-24 w-7 -translate-y-1/2 touch-none items-center justify-center rounded-l-xl border border-r-0 border-line bg-surface/60 opacity-60 backdrop-blur-sm transition-[width,background-color,opacity] select-none hover:w-9 hover:bg-white/8 hover:opacity-100 focus-visible:opacity-100 {dragging
			? 'cursor-grabbing opacity-100'
			: 'cursor-grab'} {waiting ? 'opacity-100' : ''}"
	>
		<span class="flex flex-col items-center gap-1.5">
			{#each [0, 1, 2] as dot (dot)}
				<span
					class="h-1 w-1 rounded-full transition-colors {waiting
						? 'bg-red-400'
						: 'bg-muted group-hover:bg-white'}"
				></span>
			{/each}
		</span>

		{#if waiting}
			<span
				class="pointer-events-none absolute inset-0 rounded-l-xl shadow-[0_0_24px_rgba(240,50,50,0.45)]"
			></span>
		{/if}
	</button>
{:else}
	<button
		type="button"
		aria-label="Close panel tools"
		onclick={() => (open = '')}
		class="fixed inset-0 z-70 cursor-default bg-black/40"
		transition:fade={{ duration: 150 }}
	></button>

	<div
		class="pwa-drawer fixed inset-y-0 right-0 z-80 flex w-full flex-col border-l border-line bg-surface sm:max-w-100"
		transition:fly={{ x: 24, duration: 220 }}
	>
		<header class="flex shrink-0 items-center gap-1 border-b border-line px-3 py-2.5">
			<button
				type="button"
				onclick={() => show('jump')}
				aria-label="Quick actions"
				aria-pressed={open === 'jump'}
				class="tap rounded-lg p-2 transition-colors {open === 'jump'
					? 'bg-white/10 text-white'
					: 'text-muted hover:bg-white/5 hover:text-white'}"
			>
				<Compass class="h-4.5 w-4.5" />
			</button>

			<span class="mx-1 h-5 w-px shrink-0 bg-line"></span>

			{#each panes as item (item.id)}
				<button
					type="button"
					onclick={() => (open = item.id)}
					aria-label={item.label}
					aria-pressed={open === item.id}
					class="tap relative rounded-lg p-2 transition-colors {open === item.id
						? 'bg-white/10 text-white'
						: 'text-muted hover:bg-white/5 hover:text-white'}"
				>
					<item.icon class="h-4.5 w-4.5" />

					{#if item.count}
						<span
							class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular-nums"
						>
							{item.count > 99 ? '99+' : item.count}
						</span>
					{/if}
				</button>
			{/each}

			<button
				type="button"
				onclick={() => (open = '')}
				aria-label="Close panel tools"
				class="tap ml-auto rounded-lg p-2 text-muted transition-colors hover:bg-white/8 hover:text-white"
			>
				<X class="h-4.5 w-4.5" />
			</button>
		</header>

		{#if open === 'jump'}
			<div class="flex shrink-0 items-center gap-2 border-b border-line px-5 py-3">
				<Search class="h-4 w-4 shrink-0 text-muted" />
				<input
					bind:this={search}
					bind:value={query}
					oninput={() => (index = 0)}
					onkeydown={keydown}
					placeholder="Search quick actions"
					aria-label="Search quick actions"
					autocomplete="off"
					class="w-full border-0 bg-transparent px-0 py-1 text-sm placeholder:text-muted focus:ring-0"
				/>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto p-2">
				{#each matches as jump, position (jump.label)}
					<button
						type="button"
						onclick={jump.run}
						onpointermove={() => (index = position)}
						class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors {position ===
						index
							? 'bg-white/8 text-white'
							: 'text-muted'}"
					>
						<jump.icon class="h-4 w-4 shrink-0" />
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-medium">{jump.label}</span>
							<span class="block truncate text-xs text-muted">{jump.hint}</span>
						</span>
					</button>
				{:else}
					<p class="px-3 py-8 text-center text-sm text-muted">Nothing matches that search.</p>
				{/each}
			</div>
		{:else}
			<div class="flex shrink-0 items-center gap-2 border-b border-line px-5 py-3">
				{#if active}
					<active.icon class="h-4 w-4 shrink-0 text-muted" />
					<h2 class="min-w-0 flex-1 truncate text-sm font-semibold">{active.label}</h2>
				{/if}
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto">
				{#if open === 'priorities'}
					<Priorities {panel} {now} />
				{:else if open === 'requests'}
					<Requests {panel} {now} />
				{:else if open === 'bolos'}
					<Bolos {panel} {now} />
				{:else if open === 'docs'}
					<Docs {documentation} />
				{:else if open === 'announcements'}
					<Announcements {panel} />
				{/if}
			</div>
		{/if}
	</div>
{/if}
