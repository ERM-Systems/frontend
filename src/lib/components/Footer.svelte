<script lang="ts">
	import Activity from '@lucide/svelte/icons/activity';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Lock from '@lucide/svelte/icons/lock';
	import Palette from '@lucide/svelte/icons/palette';
	import Plus from '@lucide/svelte/icons/plus';
	import Scale from '@lucide/svelte/icons/scale';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Users from '@lucide/svelte/icons/users';
	import { siDiscord, siGithub, siYoutube } from 'simple-icons';
	import type { Component } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { page } from '$app/state';
	import type { State, Status } from '$lib/server/status';

	type Link = {
		label: string;
		href: string;
		icon: Component | string;
		external?: boolean;
		reload?: boolean;
	};

	const columns: { title: string; links: Link[] }[] = [
		{
			title: 'Product',
			links: [
				{ label: 'Dashboard', href: resolve('/guilds'), icon: LayoutDashboard },
				{ label: 'Features', href: resolve('/features'), icon: Sparkles },
				{ label: 'Whitelabel', href: resolve('/whitelabel'), icon: Palette },
				{ label: 'Status', href: resolve('/status'), icon: Activity }
			]
		},
		{
			title: 'Resources',
			links: [
				{
					label: 'Documentation',
					href: 'https://docs.ermbot.xyz',
					icon: BookOpen,
					external: true
				},
				{ label: 'Invite ERM', href: resolve('/invite'), icon: Plus, reload: true },
				{ label: 'Terms of Service', href: resolve('/terms'), icon: Scale },
				{ label: 'Privacy Policy', href: resolve('/privacy'), icon: Lock }
			]
		},
		{
			title: 'Community',
			links: [
				{
					label: 'Support Server',
					href: 'https://discord.gg/FAC629TzBy',
					icon: siDiscord.path,
					external: true
				},
				{
					label: 'GitHub',
					href: 'https://github.com/ERM-Systems/ERM',
					icon: siGithub.path,
					external: true
				},
				{
					label: 'YouTube',
					href: 'https://www.youtube.com/@ermbot',
					icon: siYoutube.path,
					external: true
				},
				{ label: 'Team', href: resolve('/team'), icon: Users }
			]
		}
	];

	const dot: Record<State, string> = {
		operational: 'bg-green-500',
		degraded: 'bg-yellow-500',
		down: 'bg-red-500',
		unknown: 'bg-red-500'
	};

	const label: Record<State, string> = {
		operational: 'All services online',
		degraded: 'Some services degraded',
		down: 'Major outages',
		unknown: 'Major outages'
	};

	function overall(status: Status): State {
		const states = [status.shards.state, status.services.state];
		if (states.includes('down')) return 'down';
		if (states.includes('degraded')) return 'degraded';
		if (states.every((state) => state === 'operational')) return 'operational';
		return 'unknown';
	}

	const status = $derived(Promise.resolve(page.data.status as Status));
	const year = new Date().getFullYear();
</script>

<footer class="border-t border-line">
	<div class="mx-auto flex max-w-275 flex-col gap-10 px-6 py-12 md:flex-row md:gap-12">
		<div class="flex flex-col gap-3 md:w-1/3">
			<a href={resolve('/')} class="tap flex items-center gap-2" aria-label="ERM Systems">
				<img src="/branding/ERMred.svg" alt="" class="h-6 w-6" />
				<span class="font-semibold tracking-tight">ERM</span>
			</a>
			<p class="max-w-xs text-sm leading-relaxed text-muted">
				The all-in-one approach to game moderation logging, shift logging, and more.
			</p>
		</div>

		<div
			class="grid flex-1 grid-cols-2 gap-8 sm:auto-cols-max sm:grid-flow-col sm:grid-cols-none sm:justify-between"
		>
			{#each columns as column (column.title)}
				<div class="flex flex-col gap-3">
					<span class="text-sm font-semibold">{column.title}</span>
					<ul class="flex flex-col gap-2.5">
						{#each column.links as link (link.label)}
							<li>
								<a
									href={link.href as ResolvedPathname}
									target={link.external ? '_blank' : undefined}
									rel={link.external ? 'noreferrer' : undefined}
									data-sveltekit-reload={link.reload ? true : undefined}
									class="flex items-center gap-2 text-sm text-muted transition-colors hover:text-white"
								>
									{#if typeof link.icon === 'string'}
										<svg
											viewBox="0 0 24 24"
											fill="currentColor"
											aria-hidden="true"
											class="h-4 w-4 shrink-0"
										>
											<path d={link.icon} />
										</svg>
									{:else}
										{@const Icon = link.icon}
										<Icon class="h-4 w-4 shrink-0" />
									{/if}
									{link.label}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</div>

	<div class="border-t border-line">
		<div
			class="mx-auto flex max-w-275 flex-col-reverse gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
		>
			<p class="text-sm text-muted">&copy; {year} ERM Systems. All rights reserved.</p>

			<a
				href={resolve('/status')}
				class="flex items-center gap-2 text-sm text-muted transition-colors hover:text-white"
			>
				{#await status}
					<span class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-white/25"></span>
					<span class="skeleton">Checking service status</span>
				{:then resolved}
					<span class="h-2 w-2 shrink-0 rounded-full {dot[overall(resolved)]}"></span>
					{label[overall(resolved)]}
				{/await}
			</a>
		</div>
	</div>
</footer>
