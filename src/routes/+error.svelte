<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import House from '@lucide/svelte/icons/house';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { fly } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	interface Explanation {
		title: string;
		hint: string;
	}

	const explanations: Record<number, Explanation> = {
		400: { title: 'That request did not make sense', hint: 'Check the link and try again.' },
		401: { title: 'You need to sign in', hint: 'Sign in with Discord to see this page.' },
		403: { title: 'You cannot open this', hint: 'Your rank in that server does not reach here.' },
		404: { title: 'Nothing lives here', hint: 'The page moved, or it never existed.' },
		429: { title: 'Slow down a moment', hint: 'You sent too many requests, wait a few seconds.' },
		500: { title: 'Something broke on our side', hint: 'Try again shortly, we log every one.' },
		502: { title: 'We cannot reach the bot', hint: 'This usually clears up within a minute.' },
		503: { title: 'We are down for maintenance', hint: 'Check back in a little while.' }
	};

	const status = $derived(page.status);
	const fallback = $derived<Explanation>(
		status >= 500
			? explanations[500]
			: { title: 'That did not work', hint: 'Try again, or head back home.' }
	);

	const explanation = $derived(explanations[status] ?? fallback);
	const detail = $derived(page.error?.message ?? '');
	const retryable = $derived(status >= 500 || status === 429);
</script>

<svelte:head><title>{status} - ERM Systems</title></svelte:head>

<section class="mx-auto flex max-w-150 flex-col items-center px-6 py-28 text-center">
	<div in:fly={{ y: 12, duration: 320 }}>
		<p
			class="bg-linear-to-b from-white to-white/25 bg-clip-text text-8xl font-bold tracking-tighter text-transparent"
		>
			{status}
		</p>

		<h1 class="mt-4 text-3xl font-bold tracking-[-0.03em]">{explanation.title}</h1>
		<p class="mt-3 text-muted">{explanation.hint}</p>

		{#if detail && detail !== explanation.title}
			<p class="mt-6 rounded-xl border border-line bg-surface px-5 py-4 text-sm text-muted">
				{detail}
			</p>
		{/if}

		<div class="mt-8 flex flex-wrap items-center justify-center gap-2">
			<a
				href={resolve('/')}
				class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<House class="h-4 w-4" />
				Home
			</a>

			<button
				type="button"
				onclick={() => history.back()}
				class="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/8 pointer-coarse:py-3"
			>
				<ArrowLeft class="h-4 w-4" />
				Go back
			</button>

			{#if retryable}
				<button
					type="button"
					onclick={() => location.reload()}
					class="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/8 pointer-coarse:py-3"
				>
					<RefreshCw class="h-4 w-4" />
					Try again
				</button>
			{/if}
		</div>
	</div>
</section>
