<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { fade, fly } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		width = 'max-w-lg',
		tall = false,
		onclose,
		footer,
		children
	}: {
		title: string;
		description?: string;
		width?: string;
		tall?: boolean;
		onclose: () => void;
		footer?: Snippet;
		children: Snippet;
	} = $props();

	const focusable =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	let pane = $state<HTMLElement>();

	$effect(() => {
		const previous = document.activeElement as HTMLElement | null;

		queueMicrotask(() => {
			const first = pane?.querySelector<HTMLElement>(focusable);
			(first ?? pane)?.focus();
		});

		return () => previous?.focus();
	});

	function trap(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (pane?.querySelector('[aria-expanded="true"]')) return;

			event.preventDefault();
			onclose();
			return;
		}

		if (event.key !== 'Tab' || !pane) return;

		const targets = [...pane.querySelectorAll<HTMLElement>(focusable)].filter(
			(node) => node.offsetParent !== null
		);
		if (!targets.length) return;

		const first = targets[0];
		const last = targets[targets.length - 1];
		const active = document.activeElement;

		if (event.shiftKey && (active === first || active === pane)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<div
	class="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm"
	role="presentation"
	onclick={onclose}
	transition:fade={{ duration: 120 }}
></div>

<div
	bind:this={pane}
	role="dialog"
	aria-modal="true"
	aria-label={title}
	tabindex="-1"
	onkeydown={trap}
	transition:fly={{ y: -8, duration: 150 }}
	class="fixed inset-x-4 z-100 mx-auto flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60 focus:outline-none {tall
		? 'top-6 max-h-[calc(100dvh-3rem)]'
		: 'top-20 max-h-[calc(100dvh-6rem)]'} {width}"
>
	<header class="flex shrink-0 items-start gap-4 border-b border-line px-5 py-4">
		<div class="min-w-0 flex-1">
			<h2 class="text-sm font-semibold tracking-wide">{title}</h2>
			{#if description}
				<p class="mt-1 text-sm text-muted">{description}</p>
			{/if}
		</div>

		<button
			type="button"
			onclick={onclose}
			aria-label="Close {title}"
			class="tap -mr-1 shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-white/8 hover:text-white"
		>
			<X class="h-4 w-4" />
		</button>
	</header>

	<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
		{@render children()}
	</div>

	{#if footer}
		<footer
			class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4"
		>
			{@render footer()}
		</footer>
	{/if}
</div>
