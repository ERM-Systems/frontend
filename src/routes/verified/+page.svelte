<script lang="ts">
	import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
	import Check from '@lucide/svelte/icons/check';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { fly, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	interface Explanation {
		title: string;
		headline: string;
		body: string;
		hint: string;
	}

	const { data }: { data: PageData } = $props();

	const explanations: Record<string, Explanation> = {
		not_allowed: {
			title: 'Cannot link this account',
			headline: 'ROBLOX blocked the request',
			body: 'ROBLOX does not allow OAuth verification for accounts under 13, a restriction they enforce on their end that ERM cannot see or override.',
			hint: 'If your account should qualify, check the birthdate in your ROBLOX account settings.'
		},
		unauthorized: {
			title: 'This link expired',
			headline: 'We could not find your verification session',
			body: 'Verification links only last a little while, and this one is no longer valid. You may have waited too long, or it has already been used.',
			hint: 'Run /link in Discord again to get a fresh one.'
		}
	};

	const fallback: Explanation = {
		title: 'Something went wrong',
		headline: 'Verification did not go through',
		body: 'This is usually a temporary hiccup on our end.',
		hint: 'Give it another try. If it keeps happening, contact our support team.'
	};

	const explanation = $derived(data.error ? (explanations[data.error] ?? fallback) : null);

	const retryUrl = $derived.by(() => {
		if (!data.state) return '';

		const url = new URL('https://verify.ermbot.xyz/login');
		url.searchParams.set('state', data.state);
		if (data.staging) url.searchParams.set('staging', 'true');
		if (data.affiliates) url.searchParams.set('affiliates', 'true');

		return url.toString();
	});

	$effect(() => {
		if (data.panel) window.close();
	});
</script>

<svelte:head><title>Verified - ERM Systems</title></svelte:head>

{#if data.panel}
	<section class="mx-auto max-w-150 px-6 py-28 text-center">
		<p class="text-muted">You can close this window.</p>
	</section>
{:else if explanation}
	<section class="mx-auto max-w-125 px-6 py-28" in:fly={{ y: 12, duration: 320 }}>
		<div class="rounded-2xl border border-line bg-surface p-8 text-center">
			<div
				class="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10"
			>
				<AlertTriangle class="h-7 w-7 text-red-400" />
			</div>

			<h1 class="mt-5 text-2xl font-bold tracking-[-0.03em]">{explanation.title}</h1>
			<p class="mt-2 text-sm font-semibold">{explanation.headline}</p>

			<p class="mt-5 text-sm text-muted">{explanation.body}</p>
			<p class="mt-4 rounded-xl border border-line bg-white/3 px-4 py-3 text-xs text-muted">
				{explanation.hint}
			</p>

			{#if data.error === 'not_allowed'}
				<p
					class="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400/90"
				>
					<strong class="font-semibold">Minimum age:</strong> ROBLOX requires accounts to be 13 or older
					to use OAuth sign in.
				</p>
			{/if}

			<div class="mt-6 flex flex-col gap-2">
				{#if retryUrl}
					<a
						href={retryUrl}
						rel="external"
						class="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
					>
						<RefreshCw class="h-4 w-4" />
						Try again
					</a>
				{:else}
					<button
						type="button"
						onclick={() => history.back()}
						class="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
					>
						<RefreshCw class="h-4 w-4" />
						Try again
					</button>
				{/if}

				<a
					href="https://discord.gg/FAC629TzBy"
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/8 pointer-coarse:py-3"
				>
					<MessageCircle class="h-4 w-4" />
					Contact support
				</a>
			</div>
		</div>
	</section>
{:else}
	<section
		class="mx-auto max-w-150 px-6 py-24 text-center"
		in:fly={{ y: 20, duration: 700, easing: backOut }}
	>
		<div
			class="mx-auto h-32 w-32 overflow-hidden rounded-full border border-line bg-surface"
			in:scale={{ delay: 300, duration: 500 }}
		>
			{#await data.roblox}
				<div class="h-full w-full animate-pulse bg-white/5"></div>
			{:then roblox}
				{#if roblox?.avatarUrl}
					<img
						src={roblox.avatarUrl}
						alt="{roblox.username} on ROBLOX"
						class="h-full w-full object-cover"
					/>
				{:else}
					<div class="flex h-full w-full items-center justify-center text-sm text-muted">
						No avatar
					</div>
				{/if}
			{/await}
		</div>

		<h1 class="mt-8 text-4xl font-bold tracking-[-0.03em]">
			{#await data.roblox then roblox}
				Welcome, {roblox?.username || data.username}!
			{/await}
		</h1>

		<p class="mt-3 text-muted">Your ROBLOX account is now linked to ERM.</p>

		<div class="mt-10 rounded-2xl border border-line bg-surface p-6 text-left">
			<h2 class="text-sm tracking-wide text-muted uppercase">What is next</h2>

			<ul class="mt-4 flex flex-col gap-3 text-sm">
				<li class="flex items-center gap-3">
					<Check class="h-4 w-4 shrink-0 text-green-400" />
					Use Bring and Teleport from the moderator panel
				</li>
				<li class="flex items-center gap-3">
					<Check class="h-4 w-4 shrink-0 text-green-400" />
					Get notified when you are moderated in game
				</li>
				<li class="flex items-center gap-3">
					<Check class="h-4 w-4 shrink-0 text-green-400" />
					Run commands remotely on your servers
				</li>
			</ul>
		</div>

		<a
			href={resolve('/')}
			class="mt-8 inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
		>
			Continue to dashboard
		</a>
	</section>
{/if}
