<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	const key = 'betaNoticeSeen';

	let open = $state(false);

	function seen(): boolean {
		try {
			return localStorage.getItem(key) === 'true';
		} catch {
			return false;
		}
	}

	function dismiss() {
		open = false;

		try {
			localStorage.setItem(key, 'true');
		} catch {
			return;
		}
	}

	export function show() {
		if (seen()) return;
		open = true;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') dismiss();
	}}
/>

{#if open}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-100 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="beta-notice-title"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 id="beta-notice-title" class="text-lg font-semibold">Beta testing</h2>
		<p class="mt-2 text-sm text-muted">
			This panel is in beta testing. Please report all bugs to your superiors and use the
			<a
				href="https://ermbot.xyz"
				class="font-semibold text-white underline underline-offset-2 transition-opacity hover:opacity-80"
			>
				original site
			</a>
			if these bugs are preventing you from completing your duties. We thank you for participating in
			our testing program.
		</p>

		<button
			type="button"
			onclick={dismiss}
			class="mt-6 w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
		>
			Got it
		</button>
	</div>
{/if}
