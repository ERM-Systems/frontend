<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { reveal } from '$lib/actions/reveal';
	import Footer from '$lib/components/Footer.svelte';
	import Meta from '$lib/components/Meta.svelte';
	import { features } from '$lib/features';
	import { utm } from '$lib/utm';

	const showcase = features.filter((feature) => feature.image);
</script>

<Meta
	title="Features - ERM Systems"
	description="Every system ERM runs for your community, from live moderation to staff quotas. Open any one to see how it works."
/>

<section class="relative overflow-hidden">
	<div
		class="pointer-events-none absolute -top-50 left-1/2 h-150 w-250 -translate-x-1/2 rounded-full opacity-60 blur-[120px]"
		style="background: radial-gradient(closest-side, rgba(160,20,20,0.30), transparent)"
	></div>

	<div class="relative mx-auto max-w-275 px-6 pt-20 pb-16 text-center">
		<p class="text-sm font-semibold">Features</p>
		<h1 class="mt-2 text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
			Everything you need to be the best.
		</h1>
		<p class="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance text-muted">
			Every system ERM runs for your community, from live moderation to staff quotas. Open any one
			to see how it works.
		</p>

		<div class="mt-10 flex flex-wrap justify-center gap-3">
			<a
				href={utm(resolve('/invite'), 'features-hero') as ResolvedPathname}
				data-sveltekit-reload
				class="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/85"
			>
				Invite ERM
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

<section class="mx-auto flex max-w-350 flex-col gap-24 px-6 pb-28 lg:gap-32">
	{#each showcase as feature, i (feature.slug)}
		<article class="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
			<div
				use:reveal={{ from: i % 2 === 0 ? 'right' : 'left' }}
				class="overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/60 {i %
					2 ===
				0
					? 'lg:order-last'
					: ''}"
			>
				{#if feature.image}
					<enhanced:img
						src={feature.image}
						alt="{feature.title} in the ERM dashboard"
						class="w-full rounded-lg"
						loading={i === 0 ? 'eager' : 'lazy'}
					/>
				{/if}
			</div>

			<div use:reveal={{ from: i % 2 === 0 ? 'left' : 'right' }}>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg border border-line">
						<feature.icon class="h-5 w-5" strokeWidth={1.6} />
					</div>
					<p class="text-sm font-semibold text-muted">{feature.group}</p>
				</div>

				<h2 class="mt-5 text-3xl font-bold tracking-[-0.03em] text-balance sm:text-4xl">
					{feature.title}
				</h2>

				<p class="mt-4 max-w-lg leading-relaxed text-muted">{feature.body[0]}</p>

				<ul class="mt-6 flex flex-col gap-3">
					{#each feature.points.slice(0, 4) as point (point)}
						<li class="flex items-start gap-3 text-sm">
							<Check class="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
							<span>{point}</span>
						</li>
					{/each}
				</ul>

				<a
					href={resolve('/features/[slug]', { slug: feature.slug })}
					class="group mt-8 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/8"
				>
					Learn more
					<ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
				</a>
			</div>
		</article>
	{/each}
</section>

<section class="mx-auto max-w-275 px-6 pb-32 text-center">
	<div use:reveal>
		<h2 class="text-3xl font-bold tracking-[-0.03em] text-balance sm:text-4xl">
			And so much more.
		</h2>

		<p class="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance text-muted">
			That is three of them. Everything else ERM runs for your community is set up from the same
			dashboard, and more of it will be shown here soon.
		</p>

		<div class="mt-10 flex flex-wrap justify-center gap-3">
			<a
				href={utm(resolve('/invite'), 'features-cta') as ResolvedPathname}
				data-sveltekit-reload
				class="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/85"
			>
				Invite ERM
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
