<script lang="ts">
	import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
	import Bell from '@lucide/svelte/icons/bell';
	import Check from '@lucide/svelte/icons/check';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import Info from '@lucide/svelte/icons/info';
	import X from '@lucide/svelte/icons/x';
	import { fly } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { toast } from '$lib/toast.svelte';
	import type { Notification, NotificationType } from '../../routes/+layout.server';

	let list = $state<Notification[] | null>(null);
	let open = $state(false);
	let menu = $state<HTMLElement>();

	$effect(() => {
		const incoming = page.data.notifications as Promise<Notification[]> | null;
		if (!incoming) {
			list = [];
			return;
		}

		let active = true;
		incoming.then((value) => active && (list = value));
		return () => {
			active = false;
		};
	});

	const loading = $derived(!list);
	const notifications = $derived(list ?? []);
	const unread = $derived(notifications.filter((entry) => !entry.read).length);

	const icons: Record<NotificationType, typeof Info> = {
		info: Info,
		success: Check,
		warning: AlertTriangle,
		error: X
	};

	const tint: Record<NotificationType, string> = {
		info: 'text-blue-400',
		success: 'text-green-400',
		warning: 'text-yellow-400',
		error: 'text-red-400'
	};

	function relative(time: string): string {
		const seconds = Math.max(0, Math.floor(Date.now() / 1000 - Number(time)));
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'Just now';
	}

	async function send(method: 'PUT' | 'DELETE', id: string | null, failure: string) {
		const query = id ? `?id=${id}` : '';

		const response = await fetch(`/api/notifications${query}`, { method }).catch(() => null);

		if (!response?.ok) {
			toast(failure, 'error');
			return false;
		}

		return true;
	}

	async function read(id: string) {
		const previous = notifications;
		list = notifications.map((entry) => (entry.id === id ? { ...entry, read: true } : entry));

		if (!(await send('PUT', id, 'Could not mark that as read, try again.'))) list = previous;
	}

	async function readAll() {
		const previous = notifications;
		list = notifications.map((entry) => ({ ...entry, read: true }));

		if (!(await send('PUT', null, 'Could not mark those as read, try again.'))) list = previous;
	}

	async function remove(id: string) {
		const previous = notifications;
		list = notifications.filter((entry) => entry.id !== id);

		if (!(await send('DELETE', id, 'Could not clear that notification, try again.')))
			list = previous;
	}

	async function removeAll() {
		const previous = notifications;
		list = [];

		if (!(await send('DELETE', null, 'Could not clear your notifications, try again.')))
			list = previous;
	}
</script>

<svelte:window
	onkeydown={(event) => event.key === 'Escape' && (open = false)}
	onpointerdown={(event) => {
		if (open && menu && !menu.contains(event.target as Node)) open = false;
	}}
/>

<div class="relative" bind:this={menu}>
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-label="Notifications{unread ? `, ${unread} unread` : ''}"
		aria-haspopup="menu"
		aria-expanded={open}
		class="relative block rounded-md p-2 text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:p-3.5"
	>
		<Bell class="h-4.5 w-4.5" />
		{#if unread}
			<span
				class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white ring-2 ring-bg"
			>
				{unread > 9 ? '9+' : unread}
			</span>
		{/if}
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface shadow-2xl shadow-black/60 max-sm:fixed max-sm:inset-x-2 max-sm:top-19 max-sm:mt-0 max-sm:w-auto max-sm:max-w-none"
			role="menu"
			transition:fly={{ y: -6, duration: 150 }}
		>
			<div class="flex items-center gap-2 border-b border-line px-4 py-2.5">
				<p class="flex-1 text-xs text-muted">
					{#if loading}
						Loading notifications
					{:else if unread}
						{unread} unread notification{unread === 1 ? '' : 's'}
					{:else}
						No new notifications
					{/if}
				</p>

				{#if unread}
					<button
						type="button"
						onclick={readAll}
						aria-label="Mark all as read"
						class="rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-white"
					>
						<CheckCheck class="h-4 w-4" />
					</button>
				{/if}
				{#if notifications.length}
					<button
						type="button"
						onclick={removeAll}
						class="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-white"
					>
						Clear all
					</button>
				{/if}
			</div>

			<ul class="max-h-96 divide-y divide-line/60 overflow-y-auto overscroll-contain">
				{#each notifications as notification, position (`${notification.id}:${position}`)}
					{@const Icon = icons[notification.type]}
					<li class="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5">
						<Icon class="mt-0.5 h-4 w-4 shrink-0 {tint[notification.type]}" />

						<div class="min-w-0 flex-1">
							{#if notification.application}
								<a
									href={resolve('/[guildID]/apply/[uuid]', {
										guildID: notification.application.guildId,
										uuid: notification.application.applicationId
									})}
									onclick={() => {
										open = false;
										if (!notification.read) read(notification.id);
									}}
									class="text-sm underline-offset-2 hover:underline {notification.read
										? 'text-muted'
										: 'text-white'}"
								>
									{notification.content}
								</a>
								<p class="mt-1 text-xs text-muted">Open this application</p>
							{:else}
								<p class="text-sm {notification.read ? 'text-muted' : 'text-white'}">
									{notification.content}
								</p>
							{/if}
							<p class="mt-1 flex items-center gap-2 text-xs text-muted">
								{relative(notification.time)}
								{#if notification.global}
									<span
										class="rounded bg-white/8 px-1.5 py-0.5 text-[10px] tracking-wide uppercase"
									>
										Global
									</span>
								{/if}
							</p>
						</div>

						<div class="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
							{#if !notification.read}
								<button
									type="button"
									onclick={() => read(notification.id)}
									aria-label="Mark as read"
									class="rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-white"
								>
									<Check class="h-3.5 w-3.5" />
								</button>
							{/if}
							<button
								type="button"
								onclick={() => remove(notification.id)}
								aria-label="Clear notification"
								class="rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-white"
							>
								<X class="h-3.5 w-3.5" />
							</button>
						</div>
					</li>
				{:else}
					<li class="flex flex-col items-center gap-2 px-4 py-10 text-center">
						<Bell class="h-5 w-5 text-muted" />
						<p class="text-sm text-muted">
							{loading ? 'Fetching your notifications' : 'You are all caught up'}
						</p>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
