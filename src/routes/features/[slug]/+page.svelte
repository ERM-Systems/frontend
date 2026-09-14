<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { reveal } from '$lib/actions/reveal';
	import Footer from '$lib/components/Footer.svelte';
	import Meta from '$lib/components/Meta.svelte';
	import { features, findFeature } from '$lib/features';
	import { utm } from '$lib/utm';

	const { data } = $props();

	const feature = $derived(findFeature(data.slug)!);

	const related = $derived(
		features
			.filter((item) => item.group === feature.group && item.slug !== feature.slug)
			.slice(0, 3)
	);
</script>

<Meta title="{feature.title} - ERM Systems" description={feature.summary} />

<article class="relative overflow-hidden">
	<div
		class="pointer-events-none absolute -top-50 left-1/2 h-150 w-250 -translate-x-1/2 rounded-full opacity-60 blur-[120px]"
		style="background: radial-gradient(closest-side, rgba(160,20,20,0.30), transparent)"
	></div>

	<div class="relative mx-auto max-w-225 px-6 pt-14 pb-24">
		<a
			href={resolve('/features')}
			class="inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-white"
		>
			<ArrowLeft class="h-4 w-4" />
			All features
		</a>

		<div class="mt-10 flex items-center gap-4">
			<div
				class="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl border border-line bg-surface sm:h-15 sm:w-15"
			>
				<feature.icon class="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.6} />
			</div>

			<h1 class="text-4xl leading-none font-bold tracking-[-0.03em] text-balance sm:text-5xl">
				{feature.title}
			</h1>
		</div>

		<p class="mt-5 max-w-2xl text-lg leading-relaxed text-balance text-muted">{feature.summary}</p>

		{#if feature.image}
			<div
				class="mt-12 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/60"
			>
				<enhanced:img
					src={feature.image}
					alt="{feature.title} in the ERM dashboard"
					class="w-full rounded-lg"
				/>
			</div>
		{:else}
			<div
				class="relative mt-12 flex h-60 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface sm:h-72"
			>
				<div
					class="pointer-events-none absolute inset-0"
					style="background: radial-gradient(closest-side, rgba(160,20,20,0.35), transparent)"
				></div>
				<feature.icon class="relative h-16 w-16 text-white/80" strokeWidth={1.2} />
			</div>
		{/if}

		<div class="mt-14 grid gap-12 lg:grid-cols-[1fr_20rem] lg:gap-16">
			<div class="flex flex-col gap-5">
				{#each feature.body as paragraph (paragraph)}
					<p class="leading-relaxed text-muted">{paragraph}</p>
				{/each}

				<div class="mt-4 flex flex-wrap gap-3">
					<a
						href={utm(resolve('/invite'), 'feature-page') as ResolvedPathname}
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

			{#if feature.points.length}
				<aside
					class="rounded-xl border border-line bg-surface p-6 lg:sticky lg:top-20 lg:self-start"
				>
					<h2 class="font-semibold">What you can do</h2>

					<ul class="mt-5 flex flex-col gap-3">
						{#each feature.points as point (point)}
							<li class="flex items-start gap-3 text-sm">
								<Check class="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
								<span class="text-muted">{point}</span>
							</li>
						{/each}
					</ul>
				</aside>
			{/if}
		</div>
	</div>
</article>

{#if related.length}
	<section class="mx-auto max-w-225 px-6 pb-32">
		<h2 class="text-sm font-semibold text-muted">More in {feature.group}</h2>

		<div class="mt-6 grid gap-4 sm:grid-cols-3">
			{#each related as item (item.slug)}
				<a
					href={resolve('/features/[slug]', { slug: item.slug })}
					use:reveal
					class="group flex h-full flex-col rounded-xl border border-line bg-surface p-6 transition-colors hover:border-white/20 hover:bg-white/5"
				>
					<div class="flex items-start justify-between gap-4">
						<item.icon class="h-5 w-5" strokeWidth={1.6} />
						<ArrowRight
							class="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-white"
						/>
					</div>

					<h3 class="mt-5 font-semibold">{item.title}</h3>
					<p class="mt-1 text-sm leading-relaxed text-muted">{item.summary}</p>
				</a>
			{/each}
		</div>
	</section>
{/if}

<Footer />
