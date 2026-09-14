<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import {
		ComponentType,
		intToHex,
		type ActionRow,
		type Block,
		type DiscordEmbed,
		type EmbedField,
		type DiscordMessage
	} from '$lib/discord';
	import { spans, type Span } from '$lib/markdown';

	let { message }: { message: DiscordMessage } = $props();

	const empty = $derived(!message.content && !message.embeds.length && !message.components.length);

	function accent(value: number | null): string {
		return value === null ? '#4e5058' : intToHex(value);
	}

	function lines(text: string): string[] {
		return text.split('\n');
	}

	interface FieldRow {
		fields: EmbedField[];
	}

	const buttonTones: Record<number, string> = {
		1: 'bg-[#5865f2] text-white',
		2: 'bg-[#4e5058] text-white',
		3: 'bg-[#248046] text-white',
		4: 'bg-[#da373c] text-white',
		5: 'bg-[#4e5058] text-white'
	};

	function fieldRows(fields: EmbedField[]): FieldRow[] {
		const rows: FieldRow[] = [];
		let inline: EmbedField[] = [];

		const flush = () => {
			if (inline.length) {
				rows.push({ fields: inline });
				inline = [];
			}
		};

		for (const field of fields) {
			if (!field.name && !field.value) continue;

			if (field.inline) {
				inline.push(field);
				if (inline.length === 3) flush();
			} else {
				flush();
				rows.push({ fields: [field] });
			}
		}

		flush();
		return rows;
	}
</script>

{#snippet inlineSpans(parts: Span[])}
	{#each parts as part, index (index)}
		{#if part.kind === 'bold'}
			<strong class="font-semibold text-white">{part.text}</strong>
		{:else if part.kind === 'italic'}
			<em class="italic">{part.text}</em>
		{:else if part.kind === 'strike'}
			<s class="opacity-70">{part.text}</s>
		{:else if part.kind === 'code'}
			<code class="rounded bg-black/30 px-1 py-0.5 text-[0.85em]">{part.text}</code>
		{:else if part.kind === 'image'}
			<img src={part.src} alt={part.alt} loading="lazy" class="my-1 max-h-60 rounded" />
		{:else if part.kind === 'link'}
			<a
				href={part.href}
				target="_blank"
				rel="noreferrer noopener nofollow"
				class="text-[#00a8fc] hover:underline">{part.text}</a
			>
		{:else}
			{part.text}
		{/if}
	{/each}
{/snippet}

{#snippet rich(text: string, tone: string)}
	<div class="text-sm leading-5.5 {tone}">
		{#each lines(text) as line, index (index)}
			<div class="min-h-5.5">{@render inlineSpans(spans(line))}</div>
		{/each}
	</div>
{/snippet}

{#snippet blockView(block: Block)}
	{#if block.type === ComponentType.TextDisplay}
		{@render rich(block.content, 'text-[#dbdee1]')}
	{:else if block.type === ComponentType.Separator}
		<div class={block.spacing === 2 ? 'py-2.5' : 'py-1'}>
			{#if block.divider}
				<div class="h-px bg-white/10"></div>
			{/if}
		</div>
	{:else if block.type === ComponentType.MediaGallery}
		<div class="grid grid-cols-2 gap-1">
			{#each block.items.filter((item) => item.media.url) as item (item.media.url)}
				<img
					src={item.media.url}
					alt={item.description}
					class="h-28 w-full rounded-lg object-cover"
				/>
			{/each}
		</div>
	{:else if block.type === ComponentType.Section}
		<div class="flex items-start gap-3">
			<div class="min-w-0 flex-1 space-y-1">
				{#each block.components as text (text)}
					{@render rich(text.content, 'text-[#dbdee1]')}
				{/each}
			</div>
			{#if block.accessory.media.url}
				<img
					src={block.accessory.media.url}
					alt=""
					class="h-18 w-18 shrink-0 rounded-lg object-cover"
				/>
			{/if}
		</div>
	{:else}
		<p class="rounded-md border border-dashed border-white/15 px-2 py-1 text-xs text-[#949ba4]">
			Custom component (type {block.raw.type})
		</p>
	{/if}
{/snippet}

{#snippet rowView(row: ActionRow)}
	<div class="flex flex-wrap gap-2">
		{#each row.components as button (button)}
			<span
				class="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium {buttonTones[
					button.style
				]} {button.disabled ? 'opacity-50' : ''}"
			>
				{button.label || 'Button'}
				{#if button.style === 5}
					<ExternalLink class="h-3.5 w-3.5 opacity-70" />
				{/if}
			</span>
		{/each}
	</div>
{/snippet}

{#snippet embedView(embed: DiscordEmbed)}
	<div
		class="max-w-130 rounded border-l-4 bg-[#2b2d31] py-3 pr-4 pl-3"
		style="border-color: {accent(embed.color)}"
	>
		<div class="flex gap-4">
			<div class="min-w-0 flex-1">
				{#if embed.author.name}
					<div class="mb-2 flex items-center gap-2">
						{#if embed.author.icon_url}
							<img src={embed.author.icon_url} alt="" class="h-6 w-6 rounded-full" />
						{/if}
						<span class="text-sm font-semibold text-white">{embed.author.name}</span>
					</div>
				{/if}

				{#if embed.title}
					<p class="mb-2 text-base font-semibold {embed.url ? 'text-[#00a8fc]' : 'text-white'}">
						{embed.title}
					</p>
				{/if}

				{#if embed.description}
					{@render rich(embed.description, 'text-[#dbdee1]')}
				{/if}

				{#each fieldRows(embed.fields) as row (row.fields[0])}
					<div
						class="mt-2 grid gap-2"
						style="grid-template-columns: repeat({row.fields.length}, minmax(0, 1fr))"
					>
						{#each row.fields as field (field)}
							<div class="min-w-0">
								<p class="text-[13px] font-semibold text-[#f2f3f5]">
									{@render inlineSpans(spans(field.name))}
								</p>
								<p class="mt-0.5 text-[13px] leading-4.5 text-[#dbdee1]">
									{@render inlineSpans(spans(field.value))}
								</p>
							</div>
						{/each}
					</div>
				{/each}
			</div>

			{#if embed.thumbnail.url}
				<img src={embed.thumbnail.url} alt="" class="h-20 w-20 shrink-0 rounded-lg object-cover" />
			{/if}
		</div>

		{#if embed.image.url}
			<img src={embed.image.url} alt="" class="mt-3 max-w-full rounded-lg object-cover" />
		{/if}

		{#if embed.footer.text}
			<div class="mt-2 flex items-center gap-2">
				{#if embed.footer.icon_url}
					<img src={embed.footer.icon_url} alt="" class="h-5 w-5 rounded-full" />
				{/if}
				<span class="text-xs text-[#949ba4]">{embed.footer.text}</span>
			</div>
		{/if}
	</div>
{/snippet}

<div class="rounded-xl bg-[#313338] px-4 py-4">
	{#if empty}
		<p class="text-sm text-[#949ba4]">Nothing to preview yet.</p>
	{:else}
		<div class="flex gap-4">
			<img
				src="/branding/ERMred.svg"
				alt=""
				class="h-10 w-10 shrink-0 rounded-full bg-[#1e1f22] p-1.5"
			/>

			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<span class="text-base font-medium text-white">ERM</span>
					<span
						class="flex items-center gap-0.5 rounded bg-[#5865f2] px-1 py-px text-[10px] font-semibold text-white"
					>
						<Check class="h-2.5 w-2.5" strokeWidth={3} />
						APP
					</span>
					<span class="text-xs text-[#949ba4]">Today at 12:00 PM</span>
				</div>

				<div class="mt-0.5 space-y-2">
					{#if message.content}
						{@render rich(message.content, 'text-[#dbdee1]')}
					{/if}

					{#each message.embeds as embed (embed)}
						{@render embedView(embed)}
					{/each}

					{#each message.components as component (component)}
						{#if component.type === ComponentType.ActionRow}
							{@render rowView(component)}
						{:else if component.type === ComponentType.Container}
							<div
								class="max-w-130 rounded-lg border-l-4 bg-[#2b2d31] py-3 pr-4 pl-3"
								style="border-color: {accent(component.accent_color)}"
							>
								{#each component.components as block (block)}
									{@render blockView(block)}
								{/each}
							</div>
						{:else}
							{@render blockView(component)}
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
