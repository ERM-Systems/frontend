<script lang="ts">
	import { parseImport, type DiscordMessage } from '$lib/discord';
	import { toast } from '$lib/toast.svelte';

	let { message }: { message: DiscordMessage } = $props();

	let link = $state('');
	let payload = $state('');
	let linkError = $state('');
	let payloadError = $state('');

	function load(input: string, kind: 'link' | 'json') {
		const result = parseImport(input, kind);

		if ('error' in result) {
			if (kind === 'link') linkError = result.error;
			else payloadError = result.error;
			return;
		}

		linkError = '';
		payloadError = '';
		message.content = result.message.content;
		message.embeds = result.message.embeds;
		message.components = result.message.components;
		link = '';
		payload = '';
		toast('Message imported.', 'success');
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-3">
		<div>
			<p class="text-sm font-medium">Discohook share link</p>
			<p class="mt-1 text-sm text-muted">
				Paste the link from <a
					href="https://docs.discohook.app/"
					target="_blank"
					rel="noreferrer"
					class="text-white underline decoration-white/30 underline-offset-2">Discohook</a
				>. Importing replaces what you have here.
			</p>
		</div>

		<div class="flex items-stretch gap-2">
			<input
				bind:value={link}
				spellcheck="false"
				placeholder="https://discohook.app/?data=..."
				class="min-w-0 flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 font-mono text-xs placeholder:text-muted focus:border-white/25 focus:ring-0 pointer-coarse:min-h-11"
			/>

			<button
				type="button"
				onclick={() => load(link, 'link')}
				disabled={!link.trim()}
				class="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				Import link
			</button>
		</div>

		{#if linkError}
			<p class="text-sm text-red-400">{linkError}</p>
		{/if}
	</div>

	<div class="flex flex-col gap-3 border-t border-line pt-6">
		<div>
			<p class="text-sm font-medium">Message payload</p>
			<p class="mt-1 text-sm text-muted">
				Paste a Discohook backup or a raw Discord message object. Importing replaces what you have
				here.
			</p>
		</div>

		<textarea
			bind:value={payload}
			rows={12}
			spellcheck="false"
			placeholder={'{ "content": "Hello", "embeds": [] }'}
			class="w-full rounded-lg border border-line bg-white/5 px-3 py-2 font-mono text-xs placeholder:text-muted focus:border-white/25 focus:ring-0"
		></textarea>

		{#if payloadError}
			<p class="text-sm text-red-400">{payloadError}</p>
		{/if}

		<div>
			<button
				type="button"
				onclick={() => load(payload, 'json')}
				disabled={!payload.trim()}
				class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				Import payload
			</button>
		</div>
	</div>
</div>
