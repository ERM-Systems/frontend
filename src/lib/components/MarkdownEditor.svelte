<script lang="ts">
	import Bold from '@lucide/svelte/icons/bold';
	import Code from '@lucide/svelte/icons/code';
	import Eye from '@lucide/svelte/icons/eye';
	import Heading from '@lucide/svelte/icons/heading';
	import Italic from '@lucide/svelte/icons/italic';
	import Link from '@lucide/svelte/icons/link';
	import List from '@lucide/svelte/icons/list';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Quote from '@lucide/svelte/icons/quote';
	import Strikethrough from '@lucide/svelte/icons/strikethrough';
	import { tick } from 'svelte';
	import Markdown from '$lib/components/Markdown.svelte';

	let {
		value = $bindable(''),
		rows = 8,
		maxlength,
		placeholder = ''
	}: {
		value: string;
		rows?: number;
		maxlength?: number;
		placeholder?: string;
	} = $props();

	const wraps = [
		{ label: 'Bold', icon: Bold, before: '**', after: '**', sample: 'bold text' },
		{ label: 'Italic', icon: Italic, before: '*', after: '*', sample: 'italic text' },
		{
			label: 'Strikethrough',
			icon: Strikethrough,
			before: '~~',
			after: '~~',
			sample: 'struck out'
		},
		{ label: 'Code', icon: Code, before: '`', after: '`', sample: 'code' },
		{ label: 'Link', icon: Link, before: '[', after: '](https://)', sample: 'label' }
	];

	const prefixes = [
		{ label: 'Heading', icon: Heading, prefix: '## ' },
		{ label: 'Quote', icon: Quote, prefix: '> ' },
		{ label: 'List', icon: List, prefix: '- ' }
	];

	let area = $state<HTMLTextAreaElement>();
	let previewing = $state(false);

	async function select(start: number, end: number) {
		await tick();
		area?.focus();
		area?.setSelectionRange(start, end);
	}

	function wrap(before: string, after: string, sample: string) {
		if (!area) return;

		const { selectionStart, selectionEnd } = area;
		const chosen = value.slice(selectionStart, selectionEnd) || sample;

		value = value.slice(0, selectionStart) + before + chosen + after + value.slice(selectionEnd);
		void select(selectionStart + before.length, selectionStart + before.length + chosen.length);
	}

	function prefix(marker: string) {
		if (!area) return;

		const { selectionStart, selectionEnd } = area;
		const from = value.lastIndexOf('\n', selectionStart - 1) + 1;
		const head = value.slice(from, selectionEnd);
		const marked = head
			.split('\n')
			.map((entry) => (entry.startsWith(marker) ? entry : marker + entry))
			.join('\n');

		value = value.slice(0, from) + marked + value.slice(selectionEnd);
		void select(from + marked.length, from + marked.length);
	}
</script>

<div class="rounded-lg border border-line bg-white/5">
	<div class="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
		{#each wraps as tool (tool.label)}
			<button
				type="button"
				onclick={() => wrap(tool.before, tool.after, tool.sample)}
				aria-label={tool.label}
				class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
			>
				<tool.icon class="h-4 w-4" />
			</button>
		{/each}

		<span class="mx-1 h-4 w-px bg-line"></span>

		{#each prefixes as tool (tool.label)}
			<button
				type="button"
				onclick={() => prefix(tool.prefix)}
				aria-label={tool.label}
				class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
			>
				<tool.icon class="h-4 w-4" />
			</button>
		{/each}

		<button
			type="button"
			onclick={() => (previewing = !previewing)}
			aria-pressed={previewing}
			class="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors {previewing
				? 'bg-white/10 text-white'
				: 'text-muted hover:bg-white/10 hover:text-white'}"
		>
			{#if previewing}
				<PenLine class="h-3.5 w-3.5" />
				Write
			{:else}
				<Eye class="h-3.5 w-3.5" />
				Preview
			{/if}
		</button>
	</div>

	{#if previewing}
		<div class="px-3 py-2">
			{#if value.trim()}
				<Markdown source={value} />
			{:else}
				<p class="py-6 text-center text-sm text-muted">Nothing to preview yet.</p>
			{/if}
		</div>
	{:else}
		<textarea
			bind:this={area}
			bind:value
			{rows}
			{maxlength}
			{placeholder}
			class="w-full resize-y border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted focus:ring-0"
		></textarea>
	{/if}
</div>
