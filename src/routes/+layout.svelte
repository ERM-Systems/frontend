<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import { afterNavigate, invalidate, onNavigate, replaceState } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import './layout.css';
	import BetaNotice from '$lib/components/BetaNotice.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import Header from '$lib/components/Header.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import { toast } from '$lib/toast.svelte';

	let { children } = $props();

	let palette = $state<CommandPalette>();
	let beta = $state<BetaNotice>();

	const appPage = $derived(/\/guilds\/?$/.test(page.url.pathname));
	const bare = $derived(/\/offline\/?$/.test(page.url.pathname));

	const notices: Record<string, (value: string) => void> = {
		login: () => {
			const user = page.data.user as Promise<{ username: string } | null>;
			void user.then((value) =>
				toast(value ? `Signed in as ${value.username}, welcome in!` : 'Signed in', 'success')
			);
			beta?.show();
		},
		logout: () => toast('Logged out successfully, see you soon!', 'success'),
		error: () => toast('Failed to login, try again later.', 'error')
	};

	afterNavigate(() => {
		const tags = new URLSearchParams(
			[...page.url.searchParams].filter(([key]) => key.startsWith('utm_'))
		).toString();

		window.umami?.track((props) => ({
			...props,
			url: `${page.route.id ?? props.url}${tags && `?${tags}`}`
		}));

		const url = new URL(page.url);
		const fired = Object.keys(notices).filter((key) => url.searchParams.has(key));
		if (!fired.length) return;

		for (const key of fired) {
			notices[key](url.searchParams.get(key) ?? '');
			url.searchParams.delete(key);
		}

		const stripped = `${url.pathname}${url.search}` as ResolvedPathname;
		queueMicrotask(() => replaceState(stripped, page.state));
	});

	onMount(() => {
		const timer = setInterval(() => {
			if (!document.hidden) invalidate('app:status');
		}, 60_000);

		return () => clearInterval(timer);
	});

	onMount(() => {
		if (window.matchMedia('(pointer: coarse)').matches) return;

		const root = document.documentElement;
		let idle: ReturnType<typeof setTimeout>;

		const onScroll = () => {
			root.setAttribute('data-scrolling', '');
			clearTimeout(idle);
			idle = setTimeout(() => root.removeAttribute('data-scrolling'), 900);
		};

		window.addEventListener('scroll', onScroll, { capture: true, passive: true });

		return () => {
			window.removeEventListener('scroll', onScroll, { capture: true });
			clearTimeout(idle);
		};
	});

	const inDashboard = (pathname?: string) => !!pathname && /^\/\d+\/dashboard\//.test(pathname);

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;

		const settings =
			inDashboard(navigation.from?.url.pathname) && inDashboard(navigation.to?.url.pathname);
		if (settings) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

{#if !bare}
	<Header onsearch={() => palette?.show()} />
	<div class="pwa-safe-spacer h-14"></div>
{/if}
<main>{@render children()}</main>
{#if !bare}
	<CommandPalette bind:this={palette} />
	<BetaNotice bind:this={beta} />
	{#if appPage}
		<InstallPrompt />
	{/if}
{/if}
<Toaster />
