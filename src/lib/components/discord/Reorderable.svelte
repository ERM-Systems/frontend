<script lang="ts">
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import type { Snippet } from 'svelte';
	import { drag, move } from '$lib/reorder.svelte';

	let {
		list,
		index,
		label,
		class: className = '',
		children
	}: {
		list: unknown[];
		index: number;
		label: string;
		class?: string;
		children: Snippet<[Snippet]>;
	} = $props();

	let node = $state<HTMLDivElement>();

	const lifted = $derived(drag.list === list && drag.from === index);
	const target = $derived(drag.list === list && drag.over === index && drag.from !== index);

	function start(event: DragEvent) {
		event.stopPropagation();

		drag.list = list;
		drag.from = index;
		drag.over = index;

		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function over(event: DragEvent) {
		if (drag.list !== list) return;

		event.preventDefault();
		event.stopPropagation();
		drag.over = index;
	}

	function drop(event: DragEvent) {
		if (drag.list !== list) return;

		event.preventDefault();
		event.stopPropagation();
		move(list, drag.from, index);
		finish();
	}

	function finish() {
		if (node) node.draggable = false;
		drag.reset();
	}

	function nudge(event: KeyboardEvent) {
		const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : -1;
		if (to < 0 || to >= list.length) return;

		event.preventDefault();
		move(list, index, to);
	}
</script>

{#snippet handle()}
	<button
		type="button"
		aria-label="Move {label}, position {index +
			1} of {list.length}. Drag it, or use the arrow keys."
		onpointerdown={() => node && (node.draggable = true)}
		onpointerup={finish}
		onkeydown={nudge}
		class="shrink-0 cursor-grab touch-none rounded-md p-1 text-muted transition-colors hover:bg-white/10 hover:text-white active:cursor-grabbing"
	>
		<GripVertical class="h-4 w-4" />
	</button>
{/snippet}

<div
	bind:this={node}
	role="group"
	aria-label={label}
	draggable="false"
	ondragstart={start}
	ondragover={over}
	ondrop={drop}
	ondragend={finish}
	class="{className} transition-opacity {lifted ? 'opacity-40' : ''} {target
		? 'ring-2 ring-white/25'
		: ''}"
>
	{@render children(handle)}
</div>
