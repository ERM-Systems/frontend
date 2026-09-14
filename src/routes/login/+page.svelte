<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { onMount } from 'svelte';
	import discord from '$lib/assets/discord.svg';
	import { backOut } from 'svelte/easing';
	import { MediaQuery } from 'svelte/reactivity';
	import { scale } from 'svelte/transition';
	import Meta from '$lib/components/Meta.svelte';

	const shots = Object.entries(
		import.meta.glob('$lib/assets/login/*.webp', {
			eager: true,
			query: '?url',
			import: 'default'
		}) as Record<string, string>
	)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, url]) => url);

	let { data, form } = $props();

	let submitting = $state(false);
	let solved = $state(false);
	let failed = $state(false);
	let current = $state(0);
	let attempts = $state(0);
	let widget = $state<HTMLElement>();

	const blocked = $derived(submitting || (Boolean(data.siteKey) && !solved));
	const status = $derived(solved ? 'solved' : failed ? 'failed' : 'checking');
	const reduced = new MediaQuery('prefers-reduced-motion: reduce');

	type TurnstileWindow = typeof globalThis & {
		turnstile?: { reset: (widget?: string) => void };
		onTurnstileSolved?: () => void;
		onTurnstileCleared?: () => void;
	};

	onMount(() => {
		const rotate = setInterval(() => (current = (current + 1) % shots.length), 6000);

		if (data.siteKey) {
			const global = window as TurnstileWindow;

			global.onTurnstileSolved = () => {
				solved = true;
				failed = false;
			};
			global.onTurnstileCleared = () => {
				solved = false;
				failed = true;
			};

			const script = document.createElement('script');
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
			script.async = true;
			document.head.append(script);
		}

		return () => clearInterval(rotate);
	});

	$effect(() => {
		if (!data.siteKey || solved || failed) return;

		const tries = attempts;

		const timer = setTimeout(() => {
			if (widget?.getBoundingClientRect().height) return;

			if (tries >= 2) {
				failed = true;
				return;
			}

			attempts = tries + 1;
			(window as TurnstileWindow).turnstile?.reset();
		}, 15_000);

		return () => clearTimeout(timer);
	});

	$effect(() => {
		if (!form?.message) return;

		submitting = false;
		solved = false;
		(window as TurnstileWindow).turnstile?.reset();
	});
</script>

<Meta title="Sign in to ERM" description="Sign in with Discord to manage your ERM servers." />

<div class="grid min-h-[calc(100vh-3.5rem)] lg:grid-cols-2">
	<section class="flex flex-col items-center justify-center px-6 py-20">
		<div class="w-full max-w-90">
			<img
				src="/branding/ERMred.svg"
				alt="ERM"
				class="mx-auto h-20 w-auto"
				width="80"
				height="80"
			/>

			<h1 class="mt-10 text-center text-2xl font-semibold tracking-[-0.02em]">Sign in to ERM</h1>
			<p class="mt-2 text-center text-sm text-muted">Continue with your Discord account.</p>

			<form method="POST" onsubmit={() => (submitting = true)} class="relative mt-8">
				<input type="hidden" name="returnTo" value={data.returnTo} />

				<button
					type="submit"
					disabled={blocked}
					class="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-white text-sm font-semibold text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:bg-white/35 disabled:text-black/55 disabled:hover:bg-white/35"
				>
					{#if submitting}
						<LoaderCircle class="h-4 w-4 animate-spin" />
						Redirecting
					{:else}
						<img
							src={discord}
							alt=""
							class="h-4.5 w-4.5 {blocked ? 'opacity-55' : ''}"
							width="18"
							height="18"
						/>
						Continue with Discord
					{/if}
				</button>

				{#if data.siteKey}
					<p
						class="mt-4 flex items-center justify-center gap-2 text-xs text-muted"
						aria-live="polite"
					>
						<span class="grid h-3.5 w-3.5 place-items-center">
							{#key status}
								<span
									class="col-start-1 row-start-1"
									in:scale={{ duration: reduced.current ? 0 : 280, start: 0.2, easing: backOut }}
								>
									{#if status === 'solved'}
										<Check class="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.5} />
									{:else if status === 'failed'}
										<TriangleAlert class="h-3.5 w-3.5 text-amber-400" strokeWidth={2} />
									{:else}
										<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
									{/if}
								</span>
							{/key}
						</span>
						{#if status === 'solved'}
							Verified, welcome in!
						{:else if status === 'failed'}
							Verification failed.
							<button
								type="button"
								onclick={() => location.reload()}
								class="underline underline-offset-2 transition-colors hover:text-white"
							>
								Click here to retry
							</button>
						{:else}
							Checking your browser
						{/if}
					</p>
				{/if}

				{#if form?.message}
					<p class="mt-4 text-center text-sm text-red-400">{form.message}</p>
				{/if}

				{#if data.siteKey}
					<div
						bind:this={widget}
						class="cf-turnstile absolute inset-x-0 top-full mt-4 flex justify-center"
						data-sitekey={data.siteKey}
						data-theme="dark"
						data-size="flexible"
						data-appearance="interaction-only"
						data-callback="onTurnstileSolved"
						data-expired-callback="onTurnstileCleared"
						data-error-callback="onTurnstileCleared"
					></div>
				{/if}
			</form>
		</div>
	</section>

	<div class="relative hidden overflow-hidden border-l border-line lg:block">
		{#each shots as shot, i (shot)}
			<img
				src={shot}
				alt=""
				aria-hidden="true"
				loading={i === 0 ? 'eager' : 'lazy'}
				class="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
				class:opacity-0={i !== current}
			/>
		{/each}
		<div class="absolute inset-0 bg-linear-to-t from-bg via-bg/75 to-bg/25"></div>

		<div class="relative flex h-full flex-col justify-end p-12">
			<figure class="max-w-xl">
				<blockquote class="text-xl leading-relaxed font-light text-balance">
					&ldquo;Thanks to the help of ERM, we have been able to significantly improve our day to
					day operations. From game security which allows us to monitor and be alerted of unusual
					activity in game, to their desktop application which grants staff the ability to quickly
					run commands and improve our response times greatly.&rdquo;
				</blockquote>
				<figcaption class="mt-7">
					<a
						href="https://discord.gg/parp"
						target="_blank"
						rel="noreferrer"
						class="group inline-flex items-center gap-3"
					>
						<img
							src="/affiliates/parp.png"
							alt=""
							class="h-10 w-10 rounded-full ring-1 ring-white/15 transition-shadow group-hover:ring-white/35"
							width="40"
							height="40"
						/>
						<div class="text-sm">
							<p class="font-medium">Pennsylvania State Roleplay</p>
							<p class="text-muted transition-colors group-hover:text-white">gg/parp</p>
						</div>
					</a>
				</figcaption>
			</figure>
		</div>
	</div>
</div>
