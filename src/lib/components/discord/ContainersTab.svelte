<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ColorPicker from '$lib/components/settings/ColorPicker.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import Reorderable from './Reorderable.svelte';
	import {
		blankContainer,
		blankGallery,
		blankSection,
		blankSeparator,
		blankTextDisplay,
		ComponentType,
		hexToInt,
		intToHex,
		type Block,
		type Container,
		type DiscordMessage
	} from '$lib/discord';

	let { message }: { message: DiscordMessage } = $props();

	const spacingOptions = [
		{ value: '1', label: 'Small gap' },
		{ value: '2', label: 'Large gap' }
	];

	function addBlock(list: Block[], block: Block) {
		list.push(block);
	}

	function removeAt(list: unknown[], index: number) {
		list.splice(index, 1);
	}

	function addContainer() {
		message.components.push(blankContainer());
	}
</script>

{#snippet blockButtons(list: Block[])}
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			onclick={() => addBlock(list, blankTextDisplay())}
			class="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
		>
			+ Text
		</button>
		<button
			type="button"
			onclick={() => addBlock(list, blankSeparator())}
			class="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
		>
			+ Separator
		</button>
		<button
			type="button"
			onclick={() => addBlock(list, blankGallery())}
			class="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
		>
			+ Gallery
		</button>
		<button
			type="button"
			onclick={() => addBlock(list, blankSection())}
			class="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
		>
			+ Section
		</button>
	</div>
{/snippet}

{#snippet blockEditor(list: Block[], index: number)}
	{@const block = list[index]}
	<Reorderable
		{list}
		{index}
		label="block {index + 1}"
		class="rounded-lg border border-line bg-white/2 p-3"
	>
		{#snippet children(handle)}
			<div class="flex items-start gap-2">
				{@render handle()}
				<div class="min-w-0 flex-1">
					{#if block.type === ComponentType.TextDisplay}
						<div class="flex items-start gap-2">
							<div class="min-w-0 flex-1">
								<Input
									rows={2}
									bind:value={block.content}
									placeholder="Text (markdown supported)"
								/>
							</div>
							<button
								type="button"
								onclick={() => removeAt(list, index)}
								aria-label="Remove text block"
								class="shrink-0 rounded-md p-2 text-muted transition-colors hover:bg-white/10 hover:text-white"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					{:else if block.type === ComponentType.Separator}
						<div class="flex items-center gap-3">
							<span class="text-sm font-medium">Separator</span>
							<label class="flex items-center gap-2 text-sm text-muted">
								<Switch bind:checked={block.divider} label="Show divider line" />
								Line
							</label>
							<div class="w-36">
								<Select
									options={spacingOptions}
									bind:value={
										() => String(block.spacing), (next) => (block.spacing = next === '2' ? 2 : 1)
									}
								/>
							</div>
							<button
								type="button"
								onclick={() => removeAt(list, index)}
								aria-label="Remove separator"
								class="ml-auto shrink-0 rounded-md p-2 text-muted transition-colors hover:bg-white/10 hover:text-white"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					{:else if block.type === ComponentType.MediaGallery}
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium">Media gallery</span>
							<button
								type="button"
								onclick={() => removeAt(list, index)}
								aria-label="Remove gallery"
								class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>

						<div class="mt-3 flex flex-col gap-2">
							{#each block.items as item, position (item)}
								<div class="flex items-center gap-2">
									<div class="min-w-0 flex-1">
										<Input bind:value={item.media.url} placeholder="https://image" />
									</div>
									<label class="flex shrink-0 items-center gap-2 text-xs text-muted">
										<Switch bind:checked={item.spoiler} label="Spoiler" />
										Spoiler
									</label>
									<button
										type="button"
										onclick={() => removeAt(block.items, position)}
										aria-label="Remove image {position + 1}"
										class="shrink-0 rounded-md p-2 text-muted transition-colors hover:bg-white/10 hover:text-white"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							{/each}
						</div>

						{#if block.items.length < 10}
							<button
								type="button"
								onclick={() =>
									block.items.push({ media: { url: '' }, description: '', spoiler: false })}
								class="mt-2 text-xs font-semibold text-muted transition-colors hover:text-white"
							>
								+ Add image
							</button>
						{/if}
					{:else if block.type === ComponentType.Section}
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium">Section</span>
							<button
								type="button"
								onclick={() => removeAt(list, index)}
								aria-label="Remove section"
								class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>

						<div class="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
							<div class="flex flex-col gap-2">
								{#each block.components as text, position (text)}
									<div class="flex items-start gap-2">
										<div class="min-w-0 flex-1">
											<Input rows={2} bind:value={text.content} placeholder="Section text" />
										</div>
										{#if block.components.length > 1}
											<button
												type="button"
												onclick={() => removeAt(block.components, position)}
												aria-label="Remove section text {position + 1}"
												class="shrink-0 rounded-md p-2 text-muted transition-colors hover:bg-white/10 hover:text-white"
											>
												<Trash2 class="h-4 w-4" />
											</button>
										{/if}
									</div>
								{/each}

								{#if block.components.length < 3}
									<button
										type="button"
										onclick={() => block.components.push(blankTextDisplay())}
										class="text-left text-xs font-semibold text-muted transition-colors hover:text-white"
									>
										+ Add line
									</button>
								{/if}
							</div>

							<Field label="Thumbnail">
								<Input bind:value={block.accessory.media.url} placeholder="https://image" />
							</Field>
						</div>
					{:else}
						<div class="flex items-center justify-between">
							<span class="text-sm text-muted">Custom component (type {block.raw.type})</span>
							<button
								type="button"
								onclick={() => removeAt(list, index)}
								aria-label="Remove custom component"
								class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/snippet}
	</Reorderable>
{/snippet}

<div class="flex flex-col gap-5">
	<p class="text-sm text-muted">
		Containers are Discord's Components V2. A message using them cannot also use content or embeds.
	</p>

	{#each message.components as component, index (component)}
		{#if component.type === ComponentType.ActionRow}
			<Reorderable
				list={message.components}
				{index}
				label="button row {index + 1}"
				class="flex items-center gap-3 rounded-xl border border-line bg-white/2 px-4 py-3"
			>
				{#snippet children(handle)}
					{@render handle()}
					<p class="text-sm text-muted">Button row {index + 1} is edited in the Buttons tab.</p>
				{/snippet}
			</Reorderable>
		{:else if component.type === ComponentType.Container}
			{@const container = component as Container}
			<Reorderable
				list={message.components}
				{index}
				label="container {index + 1}"
				class="rounded-xl border border-line bg-white/2"
			>
				{#snippet children(handle)}
					<div class="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
						<div class="flex items-center gap-3">
							{@render handle()}
							<span class="text-sm font-semibold">Container {index + 1}</span>
							<ColorPicker
								compact
								empty={container.accent_color === null}
								onclear={() => (container.accent_color = null)}
								bind:value={
									() =>
										container.accent_color === null ? '#5865f2' : intToHex(container.accent_color),
									(next) => (container.accent_color = hexToInt(next))
								}
							/>
							<label class="flex items-center gap-2 text-xs text-muted">
								<Switch bind:checked={container.spoiler} label="Spoiler" />
								Spoiler
							</label>
						</div>

						<button
							type="button"
							onclick={() => removeAt(message.components, index)}
							aria-label="Remove container {index + 1}"
							class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>

					<div class="flex flex-col gap-3 px-4 py-4">
						{#each container.components as block, position (block)}
							{@render blockEditor(container.components, position)}
						{/each}

						{@render blockButtons(container.components)}
					</div>
				{/snippet}
			</Reorderable>
		{:else}
			{@render blockEditor(message.components as Block[], index)}
		{/if}
	{/each}

	<div
		class="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3"
	>
		<button
			type="button"
			onclick={addContainer}
			class="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-85"
		>
			<Plus class="h-3.5 w-3.5" />
			Container
		</button>
		<span class="text-xs text-muted">or add a loose block:</span>
		{@render blockButtons(message.components as Block[])}
	</div>
</div>
