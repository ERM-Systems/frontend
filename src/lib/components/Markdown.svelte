<script lang="ts">
	import { markdown, type ListBlock, type Span } from '$lib/markdown';

	let { source, compact = false }: { source: string; compact?: boolean } = $props();

	const blocks = $derived(markdown(source ?? ''));
	const headings = ['text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm', 'text-sm'];
</script>

{#snippet line(parts: Span[])}
	{#each parts as part, index (index)}
		{#if part.kind === 'bold'}
			<strong class="font-semibold text-white">{part.text}</strong>
		{:else if part.kind === 'italic'}
			<em class="italic">{part.text}</em>
		{:else if part.kind === 'strike'}
			<s class="opacity-70">{part.text}</s>
		{:else if part.kind === 'code'}
			<code class="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">{part.text}</code>
		{:else if part.kind === 'image'}
			<img
				src={part.src}
				alt={part.alt}
				loading="lazy"
				class="my-2 max-h-80 rounded-lg border border-line"
			/>
		{:else if part.kind === 'link'}
			<a
				href={part.href}
				target="_blank"
				rel="noreferrer noopener nofollow"
				class="text-white underline underline-offset-2 hover:opacity-80">{part.text}</a
			>
		{:else}
			{part.text}
		{/if}
	{/each}
{/snippet}

{#snippet list(block: ListBlock)}
	{#if block.ordered}
		<ol class="list-decimal space-y-1 pl-5">
			{#each block.items as item, position (position)}
				<li>
					{@render line(item.spans)}
					{#if item.list}{@render list(item.list)}{/if}
				</li>
			{/each}
		</ol>
	{:else}
		<ul class="list-disc space-y-1 pl-5">
			{#each block.items as item, position (position)}
				<li>
					{@render line(item.spans)}
					{#if item.list}{@render list(item.list)}{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

<div class="flex flex-col {compact ? 'gap-1' : 'gap-3'} text-sm leading-relaxed text-muted">
	{#each blocks as block, index (index)}
		{#if block.kind === 'heading'}
			<p class="font-semibold text-white {headings[block.level - 1]}">
				{@render line(block.spans)}
			</p>
		{:else if block.kind === 'quote'}
			<blockquote class="border-l-2 border-line pl-3 italic">
				{@render line(block.spans)}
			</blockquote>
		{:else if block.kind === 'code'}
			<pre
				class="overflow-x-auto rounded-lg border border-line bg-white/5 p-3 text-xs">{block.text}</pre>
		{:else if block.kind === 'rule'}
			<hr class="border-line" />
		{:else if block.kind === 'list'}
			{@render list(block)}
		{:else}
			<p>{@render line(block.spans)}</p>
		{/if}
	{/each}
</div>
