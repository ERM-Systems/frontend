<script lang="ts">
	import ShieldBan from '@lucide/svelte/icons/shield-ban';
	import { onMount } from 'svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Meta from '$lib/components/Meta.svelte';

	let heading = $state<HTMLHeadingElement | null>(null);

	onMount(() => heading?.focus());
</script>

<Meta
	title="Account Terminated - ERM Systems"
	description="This ERM account has been terminated."
	noindex
/>

<div class="flex min-h-[calc(100vh-3.5rem)] flex-col">
	<section class="relative flex flex-1 items-center overflow-hidden">
		<div
			class="pointer-events-none absolute -top-50 left-1/2 h-150 w-250 -translate-x-1/2 rounded-full opacity-60 blur-[120px]"
			style="background: radial-gradient(closest-side, rgba(160,20,20,0.30), transparent)"
		></div>

		<main
			class="relative mx-auto flex w-full max-w-150 flex-col items-center px-6 py-28 text-center"
		>
			<div
				class="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white/5"
				aria-hidden="true"
			>
				<ShieldBan class="h-6 w-6 text-muted" />
			</div>

			<p class="mt-6 text-sm font-semibold tracking-[0.2em] text-muted" aria-hidden="true">403</p>

			<h1
				bind:this={heading}
				tabindex="-1"
				class="mt-3 text-4xl font-bold tracking-[-0.03em] text-balance focus:outline-none sm:text-5xl"
			>
				Account Terminated
			</h1>

			<p class="mt-5 text-lg leading-relaxed text-balance text-muted">
				Your account has been terminated from ERM for violating ERM's Terms of Service. If you think
				this is incorrect, contact us at
				<a
					href="https://discord.gg/Qm8tEYr7at"
					target="_blank"
					rel="noopener noreferrer"
					class="font-medium text-white underline underline-offset-4 transition-colors hover:text-white/85"
				>
					discord.gg/Qm8tEYr7at<span class="sr-only"> (opens in a new tab)</span>
				</a>.
			</p>

			<form method="POST" action="/logout" class="mt-10">
				<button
					type="submit"
					class="rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/8"
				>
					Sign out
				</button>
			</form>
		</main>
	</section>

	<Footer />
</div>
