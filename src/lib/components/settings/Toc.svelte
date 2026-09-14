<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';

	let { container, minimum = 4 }: { container?: HTMLElement; minimum?: number } = $props();

	let sections = $state<{ id: string; label: string }[]>([]);
	let current = $state('');

	$effect(() => {
		const pathname = page.url.pathname;
		if (!container) return;

		let observer: IntersectionObserver | null = null;

		tick().then(() => {
			if (pathname !== page.url.pathname) return;

			const found = [...container.querySelectorAll<HTMLElement>('section[data-toc][id]')];

			sections = found.map((element) => ({
				id: element.id,
				label: element.dataset.toc ?? ''
			}));
			current = sections[0]?.id ?? '';

			if (found.length < minimum) return;

			observer = new IntersectionObserver(
				(entries) => {
					const visible = entries
						.filter((entry) => entry.isIntersecting)
						.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

					if (visible[0]) current = visible[0].target.id;
				},
				{ rootMargin: '-96px 0px -60% 0px' }
			);

			found.forEach((element) => observer?.observe(element));
		});

		return () => observer?.disconnect();
	});
</script>

{#if sections.length >= minimum}
	<aside
		class="hidden shrink-0 self-start xl:sticky xl:top-20 xl:block xl:w-52"
		aria-label="On this page"
	>
		<p class="px-3 text-xs font-semibold tracking-wide text-muted uppercase">On this page</p>

		<nav class="mt-3 flex flex-col gap-0.5">
			{#each sections as section (section.id)}
				<a
					href="#{section.id}"
					aria-current={current === section.id ? 'true' : undefined}
					class="truncate rounded-lg px-3 py-1.5 text-sm transition-colors {current === section.id
						? 'bg-white/5 font-medium text-white'
						: 'text-muted hover:bg-white/5 hover:text-white'}"
				>
					{section.label}
				</a>
			{/each}
		</nav>
	</aside>
{/if}
