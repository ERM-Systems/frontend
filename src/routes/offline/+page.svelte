<script lang="ts">
	import WifiOff from '@lucide/svelte/icons/wifi-off';
</script>

<svelte:head><title>Offline - ERM Systems</title></svelte:head>

<main class="flex min-h-svh flex-col items-center justify-center px-6 py-16 text-center">
	<div
		class="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white/5"
		aria-hidden="true"
	>
		<WifiOff class="h-6 w-6 text-muted" />
	</div>

	<h1 class="mt-6 text-2xl font-semibold">You are offline</h1>
	<p class="mt-2 max-w-sm text-sm text-muted">
		ERM needs a connection to show your servers. Everything is still here, it just cannot load until
		you are back online.
	</p>

	<button
		type="button"
		onclick={() => location.reload()}
		class="mt-8 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 pointer-coarse:py-3"
	>
		Try again
	</button>
</main>
