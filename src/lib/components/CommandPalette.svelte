<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Home from '@lucide/svelte/icons/home';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import LogIn from '@lucide/svelte/icons/log-in';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Pin from '@lucide/svelte/icons/pin';
	import Search from '@lucide/svelte/icons/search';
	import Server from '@lucide/svelte/icons/server';
	import Settings from '@lucide/svelte/icons/settings';
	import ShieldHalf from '@lucide/svelte/icons/shield-half';
	import Siren from '@lucide/svelte/icons/siren';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ResolvedPathname } from '$app/types';
	import { administratorLevel, landingSlug } from '$lib/dashboard';
	import type { Guild } from '$lib/server/guilds';
	import { modLabel } from '$lib/shortcuts';

	interface Command {
		label: string;
		section: string;
		hint?: string;
		icon?: typeof Home;
		iconUrl?: string;
		pinned?: boolean;
		guild?: Guild;
		path?: ResolvedPathname;
		run: () => void;
	}

	interface Recent {
		label: string;
		path: ResolvedPathname;
		icon?: string;
		iconUrl?: string;
	}

	const recentKey = 'erm:recent-commands';
	const recentLimit = 3;

	const iconFor: Record<string, typeof Home> = {
		Home,
		Settings,
		'Your servers': Server,
		'Server overview': LayoutDashboard,
		'Mod panel': ShieldHalf,
		'Server settings': Settings,
		Priority: Siren
	};

	let recent = $state<Recent[]>([]);
	let query = $state('');
	let index = $state(0);
	let input = $state<HTMLInputElement>();
	let open = $state(false);
	let scope = $state<string | null>(null);
	let forward = $state(true);
	let origin = $state<string | null>(null);
	let pane = $state<HTMLDivElement>();
	let listHeight = $state(0);
	let parkedScroll = 0;
	let restoring = false;

	const signedIn = $derived(Boolean(page.data.signedIn));

	function loadRecent() {
		try {
			const stored: unknown = JSON.parse(localStorage.getItem(recentKey) ?? '[]');
			recent = Array.isArray(stored)
				? (stored.filter((entry) => typeof entry?.path === 'string') as Recent[]).slice(
						0,
						recentLimit
					)
				: [];
		} catch {
			recent = [];
		}
	}

	function remember(command: Command) {
		if (!command.path) return;

		const iconUrl = scope ? scoped?.iconUrl : command.iconUrl;

		const entry: Recent = {
			label: scope ? `${scopeName} · ${command.label}` : command.label,
			path: command.path,
			icon: iconUrl ? undefined : command.label,
			iconUrl
		};

		recent = [entry, ...recent.filter((item) => item.path !== entry.path)].slice(0, recentLimit);
		localStorage.setItem(recentKey, JSON.stringify(recent));
	}

	function execute(command: Command | undefined) {
		if (!command) return;

		remember(command);
		command.run();
	}

	function navigate(path: ResolvedPathname) {
		open = false;
		goto(path);
	}

	function reload(path: string) {
		open = false;
		location.href = path;
	}

	function logout() {
		open = false;

		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '/logout';
		document.body.append(form);
		form.submit();
	}

	let servers = $state<Guild[] | null | undefined>(undefined);

	const guilds = $derived(
		[...(servers ?? [])].sort((a, b) => {
			if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
			return a.name.localeCompare(b.name);
		})
	);

	let loadingGuilds = $state(false);

	const widths = ['w-2/5', 'w-3/5', 'w-1/2'];

	async function loadGuilds() {
		if (!signedIn || loadingGuilds) return;

		loadingGuilds = true;
		servers = undefined;

		try {
			const response = await fetch('/api/guilds', { cache: 'no-store' });
			servers = response.ok ? await response.json() : null;
		} catch {
			servers = null;
		} finally {
			loadingGuilds = false;
		}
	}

	const scoped = $derived(guilds.find((guild) => guild.id === scope));
	const scopeName = $derived(scoped?.name ?? 'This server');

	function currentGuild(): string | null {
		const segment = page.url.pathname.split('/')[1] ?? '';
		return /^\d{17,20}$/.test(segment) ? segment : null;
	}

	function settingsPath(guild: Guild | undefined): ResolvedPathname {
		if (!guild) return `/${scope}/dashboard/basic` as ResolvedPathname;

		const access = { level: guild.permissionLevel, reviewer: guild.applicationAccess };
		return `/${scope}/dashboard/${landingSlug(access)}` as ResolvedPathname;
	}

	const serverCommands = $derived.by((): Command[] => {
		if (!scope) return [];

		const guild = scoped;
		const list: Command[] = [
			{
				label: 'Server overview',
				section: scopeName,
				icon: LayoutDashboard,
				path: `/${scope}/server` as ResolvedPathname,
				run: () => navigate(`/${scope}/server` as ResolvedPathname)
			}
		];

		if (!guild || guild.permissionLevel >= 1) {
			list.push({
				label: 'Mod panel',
				section: scopeName,
				icon: ShieldHalf,
				path: `/${scope}/panel` as ResolvedPathname,
				run: () => navigate(`/${scope}/panel` as ResolvedPathname)
			});
		}

		if (!guild || guild.permissionLevel >= administratorLevel || guild.applicationAccess) {
			list.push({
				label: 'Server settings',
				section: scopeName,
				icon: Settings,
				path: settingsPath(guild),
				run: () => navigate(settingsPath(guild))
			});
		}

		if (!guild || guild.permissionLevel >= 1) {
			list.push({
				label: 'Priority',
				section: scopeName,
				icon: Siren,
				path: `/${scope}/panel?dock=priorities` as ResolvedPathname,
				run: () => navigate(`/${scope}/panel?dock=priorities` as ResolvedPathname)
			});
		}

		const term = query.trim().toLowerCase();
		if (!term) return list;

		return [...list, ...recentCommands].filter((command) =>
			command.label.toLowerCase().includes(term)
		);
	});

	const recentCommands = $derived(
		recent.map((entry): Command => ({
			label: entry.label,
			section: 'Recent',
			icon: entry.icon ? iconFor[entry.icon] : undefined,
			iconUrl: entry.iconUrl,
			path: entry.path,
			run: () => navigate(entry.path)
		}))
	);

	const commands = $derived.by((): Command[] => {
		if (scope) return serverCommands;

		const list: Command[] = [...recentCommands];

		list.push(
			{
				label: 'Home',
				section: 'Go to',
				icon: Home,
				path: resolve('/'),
				run: () => navigate(resolve('/'))
			},
			{
				label: 'Your servers',
				section: 'Go to',
				hint: `${modLabel} G`,
				icon: Server,
				path: resolve('/guilds'),
				run: () => navigate(resolve('/guilds'))
			}
		);

		if (signedIn) {
			list.push({
				label: 'Settings',
				section: 'Go to',
				hint: `${modLabel} ,`,
				icon: Settings,
				path: resolve('/settings'),
				run: () => navigate(resolve('/settings'))
			});
			list.push({ label: 'Log out', section: 'Go to', icon: LogOut, run: logout });
		} else {
			list.push({
				label: 'Continue with Discord',
				section: 'Go to',
				icon: LogIn,
				run: () => reload('/login')
			});
		}

		for (const guild of guilds) {
			list.push({
				label: guild.name,
				section: 'Servers',
				iconUrl: guild.iconUrl,
				pinned: guild.pinned,
				guild,
				run: () => enterScope(guild)
			});
		}

		return list;
	});

	const visible = $derived.by(() => {
		if (scope) return commands;

		const term = query.trim().toLowerCase();
		if (!term) return commands;
		return commands.filter((command) => command.label.toLowerCase().includes(term));
	});

	$effect(() => {
		if (!open || !visible.length) return;

		void index;

		if (restoring) {
			restoring = false;
			if (pane) pane.scrollTop = parkedScroll;
			return;
		}

		pane?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' });
	});

	export function show() {
		query = '';
		index = 0;
		open = true;
		scope = currentGuild();
		origin = null;
		loadRecent();
		queueMicrotask(() => input?.focus());
		void loadGuilds();
	}

	function enterScope(guild: Guild) {
		parkedScroll = pane?.scrollTop ?? 0;
		forward = true;
		origin = guild.id;
		scope = guild.id;
		query = '';
		index = 0;
		queueMicrotask(() => input?.focus());
	}

	function leaveScope() {
		if (!scope) return false;

		forward = false;
		scope = null;
		query = '';
		index = Math.max(
			visible.findIndex((command) => command.guild?.id === origin),
			0
		);
		origin = null;
		restoring = true;
		return true;
	}

	function typing(target: EventTarget | null): boolean {
		const element = target as HTMLElement | null;
		if (!element) return false;
		return (
			element.isContentEditable ||
			['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) ||
			false
		);
	}

	function keydown(event: KeyboardEvent) {
		const mod = event.ctrlKey || event.metaKey;

		if (mod && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			if (open) open = false;
			else show();
			return;
		}

		if (open) {
			if (event.key === 'Escape') {
				open = false;
				return;
			}
			if (event.key === 'ArrowLeft' || (event.key === 'Backspace' && !query)) {
				if (input && input.selectionStart !== 0) return;
				if (leaveScope()) event.preventDefault();
				return;
			}
			if (event.key === 'ArrowRight' && !scope) {
				if (input && input.selectionStart !== query.length) return;
				const guild = visible[index]?.guild;
				if (!guild) return;
				event.preventDefault();
				enterScope(guild);
				return;
			}
			if (event.key === 'ArrowDown' || (mod && event.key.toLowerCase() === 'n')) {
				event.preventDefault();
				index = visible.length ? (index + 1) % visible.length : 0;
				return;
			}
			if (event.key === 'ArrowUp' || (mod && event.key.toLowerCase() === 'p')) {
				event.preventDefault();
				index = visible.length ? (index - 1 + visible.length) % visible.length : 0;
				return;
			}
			if (event.key === 'Enter') {
				event.preventDefault();
				execute(visible[index]);
			}
			return;
		}

		if (typing(event.target)) return;

		if (mod && event.key === ',') {
			event.preventDefault();
			if (signedIn) navigate(resolve('/settings'));
			return;
		}

		if (mod && event.key.toLowerCase() === 'g') {
			event.preventDefault();
			navigate(resolve('/guilds'));
			return;
		}

		if (!mod && event.key === '/') {
			event.preventDefault();
			show();
		}
	}
</script>

<svelte:window onkeydown={keydown} />

{#if open}
	<div
		class="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onpointerdown={() => (open = false)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed inset-x-4 top-24 z-100 mx-auto flex max-h-[60vh] max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
		role="dialog"
		aria-modal="true"
		aria-label="Command menu"
		transition:fly={{ y: -8, duration: 150 }}
	>
		<div class="flex shrink-0 items-center gap-2.5 border-b border-line px-4">
			<Search class="h-4 w-4 shrink-0 text-muted" />

			{#if scope}
				<button
					type="button"
					onclick={leaveScope}
					title="Back to everything"
					class="flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-white/5 py-1 pr-2 pl-1.5 text-xs transition-colors hover:bg-white/10"
				>
					{#if scoped?.iconUrl}
						<img src={scoped.iconUrl} alt="" class="h-3.5 w-3.5 rounded" />
					{:else}
						<Server class="h-3 w-3 text-muted" />
					{/if}
					<span class="max-w-32 truncate">{scopeName}</span>
				</button>
			{/if}

			<input
				bind:this={input}
				bind:value={query}
				oninput={() => (index = 0)}
				placeholder={scope ? 'Search this server' : 'Type a command'}
				aria-label="Type a command"
				class="w-full border-0 bg-transparent px-0 py-3.5 text-sm placeholder:text-muted focus:ring-0"
			/>

			<kbd
				class="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted pointer-coarse:hidden"
			>
				{scope ? '←' : 'esc'}
			</kbd>
		</div>

		<div
			bind:this={pane}
			class="pane min-h-0 overflow-x-hidden overflow-y-auto"
			style:height="{listHeight}px"
		>
			{#key scope}
				<ul
					bind:clientHeight={listHeight}
					class="p-1.5"
					in:fly={{ x: forward ? 24 : -24, opacity: 1, duration: 200 }}
				>
					{#each visible as command, position (`${command.section}:${command.label}`)}
						{#if command.section !== visible[position - 1]?.section}
							<li class="px-3 pt-3 pb-1.5 text-[11px] tracking-wide text-muted uppercase">
								{command.section}
							</li>
						{/if}

						<li>
							<button
								type="button"
								data-active={position === index || undefined}
								onclick={() => execute(command)}
								onpointermove={() => (index = position)}
								class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors {position ===
								index
									? 'bg-white/8 text-white'
									: 'text-muted'}"
							>
								{#if command.icon}
									<command.icon class="h-4 w-4 shrink-0" />
								{:else if command.iconUrl}
									<img src={command.iconUrl} alt="" class="h-4 w-4 shrink-0 rounded object-cover" />
								{:else}
									<span
										class="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white/10 text-[9px]"
									>
										{command.label.slice(0, 1).toUpperCase()}
									</span>
								{/if}
								<span class="flex-1 truncate">{command.label}</span>
								{#if command.guild}
									<ChevronRight class="h-3.5 w-3.5 shrink-0 text-muted" />
								{/if}
								{#if command.pinned}
									<Pin class="h-3.5 w-3.5 shrink-0 text-muted" />
								{/if}
								{#if command.hint}
									<kbd
										class="rounded border border-line px-1.5 py-0.5 text-[10px] pointer-coarse:hidden"
										>{command.hint}</kbd
									>
								{/if}
							</button>
						</li>
					{:else}
						<li class="px-3 py-6 text-center text-sm text-muted">No commands match "{query}".</li>
					{/each}

					{#if scope}
						<li
							class="border-t border-line px-3 pt-2.5 pb-1 text-center text-[11px] text-muted pointer-coarse:hidden"
						>
							Press <kbd class="rounded border border-line px-1 py-0.5">←</kbd> to go back
						</li>
					{/if}

					{#if !scope && signedIn && (loadingGuilds || servers === null)}
						<li class="px-3 pt-3 pb-1.5 text-[11px] tracking-wide text-muted uppercase">Servers</li>
						{#if loadingGuilds}
							{#each widths as width, row (row)}
								<li class="skeleton flex items-center gap-3 px-3 py-2.5">
									<span class="h-4 w-4 shrink-0 rounded bg-white/12"></span>
									<span class="h-3 rounded bg-white/10 {width}"></span>
								</li>
							{/each}
						{:else}
							<li class="px-3 py-2.5 text-sm text-muted">
								Your servers are unavailable right now.
							</li>
						{/if}
					{/if}
				</ul>
			{/key}
		</div>
	</div>
{/if}

<style>
	.pane {
		transition: height 200ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		.pane {
			transition: none;
		}
	}
</style>
