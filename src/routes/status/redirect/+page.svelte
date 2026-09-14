<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { onMount } from 'svelte';
	import Meta from '$lib/components/Meta.svelte';

	let seconds = $state(2);

	onMount(() => {
		const timer = setInterval(() => {
			seconds -= 1;
			if (seconds <= 0) {
				clearInterval(timer);
				location.href = 'https://status.ermbot.xyz';
			}
		}, 1000);

		return () => clearInterval(timer);
	});
</script>

<Meta title="Status - ERM Systems" noindex />

<section class="mx-auto flex min-h-[70vh] max-w-130 flex-col justify-center px-6 text-center">
	<h1 class="text-3xl font-bold tracking-[-0.03em]">You're leaving ERM Systems</h1>

	<p class="mt-4 text-muted">
		Redirecting you to our status page in {seconds}
		{seconds === 1 ? 'second' : 'seconds'}.
	</p>

	<a
		href="https://status.ermbot.xyz"
		rel="noopener"
		class="mx-auto mt-8 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90 pointer-coarse:py-3"
	>
		status.ermbot.xyz
		<ExternalLink class="h-4 w-4" />
	</a>
</section>
