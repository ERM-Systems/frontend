<script lang="ts">
	import Palette from '@lucide/svelte/icons/palette';
	import { resolve } from '$app/paths';
	import Footer from '$lib/components/Footer.svelte';
	import Meta from '$lib/components/Meta.svelte';
</script>

<Meta
	title="Whitelabel - ERM Systems"
	description="Whitelabel is temporarily unavailable while we work on it."
	noindex
/>

<div class="flex min-h-[calc(100vh-3.5rem)] flex-col">
	<section class="relative flex flex-1 items-center overflow-hidden">
		<div
			class="pointer-events-none absolute -top-50 left-1/2 h-150 w-250 -translate-x-1/2 rounded-full opacity-60 blur-[120px]"
			style="background: radial-gradient(closest-side, rgba(160,20,20,0.30), transparent)"
		></div>

		<div
			class="relative mx-auto flex w-full max-w-150 flex-col items-center px-6 py-28 text-center"
		>
			<div
				class="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white/5"
				aria-hidden="true"
			>
				<Palette class="h-6 w-6 text-muted" />
			</div>

			<h1 class="mt-6 text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
				Whitelabel is taking a break
			</h1>

			<p class="mt-5 text-lg leading-relaxed text-balance text-muted">
				We have turned whitelabel off while we work on it. Your branding is safe, and it will be
				back as soon as it is ready.
			</p>

			<div class="mt-10 flex flex-wrap justify-center gap-3">
				<a
					href={resolve('/features')}
					class="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/85"
				>
					Browse features
				</a>
				<a
					href={resolve('/guilds')}
					class="rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/8"
				>
					View Dashboard
				</a>
			</div>
		</div>
	</section>

	<Footer />
</div>
