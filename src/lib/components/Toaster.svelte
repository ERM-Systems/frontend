<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Info from '@lucide/svelte/icons/info';
	import X from '@lucide/svelte/icons/x';
	import { cubicOut } from 'svelte/easing';
	import type { TransitionConfig } from 'svelte/transition';
	import { dismiss, toasts, type ToastType } from '$lib/toast.svelte';

	function rise(node: Element, { duration = 380 } = {}): TransitionConfig {
		return {
			duration,
			easing: (t) => 1 - Math.pow(1 - t, 3.4),
			css: (t, u) =>
				`transform-origin: bottom center; transform: translateY(${u * 120}%) scale(${
					0.92 + t * 0.08
				}); opacity: ${Math.min(1, t * 2)}`
		};
	}

	function sink(node: Element, { duration = 220 } = {}): TransitionConfig {
		return {
			duration,
			easing: cubicOut,
			css: (t, u) =>
				`transform-origin: bottom center; transform: translateY(${u * 40}%) scale(${
					0.94 + t * 0.06
				}); opacity: ${t}`
		};
	}

	const icons = {
		success: CircleCheck,
		error: CircleAlert,
		info: Info
	};

	const tone: Record<ToastType, string> = {
		success: 'text-green-400',
		error: 'text-red-400',
		info: 'text-muted'
	};

	const surface: Record<ToastType, string> = {
		success: 'border-green-500/25 bg-green-500/12',
		error: 'border-red-500/25 bg-red-500/12',
		info: 'border-line bg-surface'
	};

	let expanded = $state(false);

	const visible = 3;

	function stacked(depth: number): string {
		if (!depth) return 'z-index: 50';

		return `transform-origin: bottom center; transform: translateY(${-depth * 8}px) scale(${
			1 - depth * 0.04
		}); opacity: ${depth < visible ? 0.7 - (depth - 1) * 0.25 : 0}; z-index: ${50 - depth}`;
	}
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-0 z-80 flex justify-center p-4 sm:justify-end"
	aria-live="polite"
>
	<div
		class="pointer-events-auto relative flex w-full max-w-sm flex-col {expanded ? 'gap-2' : ''}"
		role="list"
		onpointerenter={() => (expanded = true)}
		onpointerleave={() => (expanded = false)}
	>
		{#each toasts as item, index (item.id)}
			{@const Icon = icons[item.type]}
			{@const depth = toasts.length - 1 - index}
			<div
				role="listitem"
				in:rise
				out:sink
				class="flex min-h-13 items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur-xl transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] {surface[
					item.type
				]} {expanded || !depth ? 'relative' : 'absolute inset-x-0 bottom-0'}"
				style={expanded ? '' : stacked(depth)}
			>
				<button
					type="button"
					onclick={() => dismiss(item.id)}
					aria-label="Dismiss notification"
					class="absolute inset-0 hidden pointer-coarse:block"
				></button>

				<Icon class="h-4.5 w-4.5 shrink-0 {tone[item.type]}" />
				<p class="flex-1 text-sm">{item.message}</p>
				<button
					type="button"
					onclick={() => dismiss(item.id)}
					aria-label="Dismiss notification"
					class="rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:hidden {expanded
						? 'opacity-100'
						: 'opacity-0'}"
				>
					<X class="h-4 w-4" />
				</button>
			</div>
		{/each}
	</div>
</div>
