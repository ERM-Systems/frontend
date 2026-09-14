<script lang="ts">
	import Send from '@lucide/svelte/icons/send';
	import { stamp, type Panel } from '$lib/panelClient.svelte';

	let { panel }: { panel: Panel } = $props();

	let content = $state('');

	async function send() {
		const text = content.trim();
		if (!text) return;

		if (await panel.act('announcement', { action: 'announcement.send', content: text })) {
			content = '';
		}
	}
</script>

{#if panel.management}
	<form
		onsubmit={(event) => {
			event.preventDefault();
			void send();
		}}
		class="flex items-center gap-2 border-b border-line px-5 py-4"
	>
		<input
			bind:value={content}
			placeholder="Message every staff member"
			aria-label="Announcement"
			autocomplete="off"
			maxlength="500"
			class="w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
		/>

		<button
			type="submit"
			disabled={!!panel.pending || !content.trim()}
			class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50 pointer-coarse:py-3"
		>
			<Send class="h-4 w-4" />
			Send
		</button>
	</form>
{/if}

<ul class="divide-y divide-line">
	{#each panel.announcements as announcement (announcement.id)}
		<li class="px-5 py-4">
			<div class="flex items-baseline justify-between gap-3">
				<p class="truncate text-sm font-medium">{announcement.senderName}</p>
				<p class="shrink-0 text-xs text-muted">{stamp(Number(announcement.timestamp))}</p>
			</div>
			<p class="mt-1 text-sm text-muted">{announcement.content}</p>
		</li>
	{:else}
		<li class="px-5 py-10 text-center text-sm text-muted">
			Announcements sent while you are here will appear in this list.
		</li>
	{/each}
</ul>
