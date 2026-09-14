<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ColorPicker from '$lib/components/settings/ColorPicker.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import Reorderable from './Reorderable.svelte';
	import {
		blankEmbed,
		embedLength,
		hexToInt,
		intToHex,
		messageLimits,
		type DiscordEmbed,
		type DiscordMessage
	} from '$lib/discord';

	let { message }: { message: DiscordMessage } = $props();

	const total = $derived(message.embeds.reduce((sum, embed) => sum + embedLength(embed), 0));

	function addEmbed() {
		message.embeds.push(blankEmbed());
	}

	function removeEmbed(index: number) {
		message.embeds.splice(index, 1);
	}

	function addField(embed: DiscordEmbed) {
		embed.fields.push({ name: '', value: '', inline: false });
	}

	function removeField(embed: DiscordEmbed, index: number) {
		embed.fields.splice(index, 1);
	}
</script>

<div class="flex flex-col gap-6">
	<Field
		label="Message content"
		description="Plain text shown above the embeds."
		counter="{message.content.length}/{messageLimits.content}"
	>
		<Input rows={3} bind:value={message.content} placeholder="Optional message text" />
	</Field>

	{#each message.embeds as embed, index (embed)}
		<Reorderable
			list={message.embeds}
			{index}
			label="embed {index + 1}"
			class="rounded-xl border border-line bg-white/2"
		>
			{#snippet children(handle)}
				<div class="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
					<div class="flex items-center gap-3">
						{@render handle()}
						<span class="text-sm font-semibold">Embed {index + 1}</span>
						<span class="text-xs text-muted">{embedLength(embed)} characters</span>
						<ColorPicker
							compact
							empty={embed.color === null}
							onclear={() => (embed.color = null)}
							bind:value={
								() => (embed.color === null ? '#5865f2' : intToHex(embed.color)),
								(next) => (embed.color = hexToInt(next))
							}
						/>
					</div>

					<button
						type="button"
						onclick={() => removeEmbed(index)}
						aria-label="Remove embed {index + 1}"
						class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
					>
						<Trash2 class="h-4 w-4" />
					</button>
				</div>

				<div class="flex flex-col gap-5 px-4 py-4">
					<div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
						<Field label="Author" counter="{embed.author.name.length}/{messageLimits.authorName}">
							<Input bind:value={embed.author.name} placeholder="Author name" />
						</Field>
						<Field label="Author icon">
							<Input bind:value={embed.author.icon_url} placeholder="https://" />
						</Field>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<Field label="Title" counter="{embed.title.length}/{messageLimits.embedTitle}">
							<Input bind:value={embed.title} placeholder="Embed title" />
						</Field>
						<Field label="Title URL">
							<Input bind:value={embed.url} placeholder="https://" />
						</Field>
					</div>

					<Field
						label="Description"
						counter="{embed.description.length}/{messageLimits.embedDescription}"
					>
						<Input rows={4} bind:value={embed.description} placeholder="Embed description" />
					</Field>

					<div class="grid gap-4 sm:grid-cols-2">
						<Field label="Image URL">
							<Input bind:value={embed.image.url} placeholder="https://" />
						</Field>
						<Field label="Thumbnail URL">
							<Input bind:value={embed.thumbnail.url} placeholder="https://" />
						</Field>
					</div>

					<div>
						<div class="flex items-center justify-between">
							<p class="flex items-center gap-2 text-sm font-medium">
								Fields
								<span class="text-xs font-normal text-muted">
									{embed.fields.length}/{messageLimits.embedFields}
								</span>
							</p>
							{#if embed.fields.length < messageLimits.embedFields}
								<button
									type="button"
									onclick={() => addField(embed)}
									class="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-white/5"
								>
									<Plus class="h-3.5 w-3.5" />
									Add field
								</button>
							{/if}
						</div>

						{#if embed.fields.length}
							<div class="mt-3 flex flex-col gap-3">
								{#each embed.fields as field, position (field)}
									<div class="rounded-lg border border-line bg-white/2 p-3">
										<div class="flex items-start gap-3">
											<div class="min-w-0 flex-1">
												<Input bind:value={field.name} placeholder="Field name" />
											</div>
											<label class="flex shrink-0 items-center gap-2 pt-2 text-sm text-muted">
												<Switch bind:checked={field.inline} label="Inline" />
												Inline
											</label>
											<button
												type="button"
												onclick={() => removeField(embed, position)}
												aria-label="Remove field {position + 1}"
												class="shrink-0 rounded-md p-2 text-muted transition-colors hover:bg-white/10 hover:text-white"
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
										<div class="mt-2">
											<Input rows={2} bind:value={field.value} placeholder="Field value" />
										</div>
										<p class="mt-1 text-right text-xs text-muted">
											{field.name.length}/{messageLimits.fieldName} name, {field.value
												.length}/{messageLimits.fieldValue} value
										</p>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
						<Field label="Footer" counter="{embed.footer.text.length}/{messageLimits.footerText}">
							<Input bind:value={embed.footer.text} placeholder="Footer text" />
						</Field>
						<Field label="Footer icon">
							<Input bind:value={embed.footer.icon_url} placeholder="https://" />
						</Field>
					</div>
				</div>
			{/snippet}
		</Reorderable>
	{/each}

	{#if message.embeds.length}
		<p class="text-xs text-muted">
			{message.embeds.length}/{messageLimits.embeds} embeds, {total}/{messageLimits.embedTotal} characters
			across the message.
		</p>
	{/if}

	{#if message.embeds.length < messageLimits.embeds}
		<button
			type="button"
			onclick={addEmbed}
			class="flex items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm font-semibold text-muted transition-colors hover:border-white/25 hover:text-white"
		>
			<Plus class="h-4 w-4" />
			Add embed
		</button>
	{/if}
</div>
