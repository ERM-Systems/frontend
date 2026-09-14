<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import X from '@lucide/svelte/icons/x';
	import { ago, type Panel } from '$lib/panelClient.svelte';
	import { defaultAvatar } from '$lib/staff';
	import type { Priority } from '$lib/server/panel';

	let { panel, now }: { panel: Panel; now: number } = $props();

	let reviewing = $state<Priority | null>(null);
	let minutes = $state(15);
	let message = $state('');
	let thread = $state('');
	let draft = $state('');

	const statusTones: Record<string, string> = {
		pending: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
		accepted: 'border-green-400/30 bg-green-400/10 text-green-300',
		denied: 'border-red-400/30 bg-red-400/10 text-red-300'
	};

	function open(priority: Priority) {
		reviewing = priority;
		minutes = priority.minutes || 15;
		message = priority.message || priority.reason;
	}

	async function decide(status: 'accepted' | 'denied') {
		if (!reviewing) return;

		const done = await panel.act(`priority:${reviewing.id}`, {
			action: 'priority.update',
			id: reviewing.id,
			status,
			minutes,
			message
		});

		if (done) reviewing = null;
	}

	function toggle(priority: Priority) {
		thread = thread === priority.id ? '' : priority.id;
		draft = '';
	}

	async function comment(priority: Priority) {
		const content = draft.trim();
		if (!content) return;

		const done = await panel.act(`comment:${priority.id}`, {
			action: 'priority.comment',
			id: priority.id,
			content
		});

		if (done) draft = '';
	}
</script>

<ul class="divide-y divide-line">
	{#each panel.snapshot.priorities as priority (priority.id)}
		<li class="px-5 py-4">
			<div class="flex items-start gap-3">
				<div class="min-w-0 flex-1">
					<p class="text-sm font-medium">{priority.reason}</p>
					<p class="mt-1 text-xs text-muted">
						{ago(priority.createdAt, now)}{priority.players.length
							? ` - ${priority.players.length} player${priority.players.length === 1 ? '' : 's'}`
							: ''}
					</p>
				</div>

				<span
					class="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium {statusTones[
						priority.status
					] ?? 'border-line bg-white/5 text-muted'}"
				>
					{priority.status}
				</span>
			</div>

			<div class="mt-2 flex gap-2">
				{#if priority.status === 'pending'}
					<button
						type="button"
						onclick={() => open(priority)}
						class="rounded-lg border border-line bg-white/5 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10"
					>
						Review
					</button>
				{/if}

				<button
					type="button"
					onclick={() => toggle(priority)}
					aria-expanded={thread === priority.id}
					class="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10"
				>
					<MessageSquare class="h-3.5 w-3.5" />
					Comments{priority.comments.length ? ` (${priority.comments.length})` : ''}
				</button>
			</div>

			{#if thread === priority.id}
				<div class="mt-3 space-y-3 border-l border-line pl-3">
					{#each priority.comments as entry (entry.id)}
						<div class="flex items-start gap-2">
							<img
								src={entry.avatarUrl}
								alt=""
								onerror={(event) => {
									const image = event.currentTarget as HTMLImageElement;
									const fallback = defaultAvatar(entry.userId);
									if (image.src !== fallback) image.src = fallback;
								}}
								class="h-6 w-6 shrink-0 rounded-full border border-line bg-white/5 object-cover"
							/>

							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted">
									{entry.username} - {ago(entry.createdAt, now)}
								</p>
								<p class="mt-0.5 text-sm wrap-break-word">{entry.content}</p>
							</div>
						</div>
					{:else}
						<p class="text-xs text-muted">No comments on this priority yet.</p>
					{/each}

					<div class="flex gap-2">
						<input
							bind:value={draft}
							placeholder="Write a comment"
							aria-label="Write a comment"
							autocomplete="off"
							onkeydown={(event) => event.key === 'Enter' && comment(priority)}
							class="min-w-0 flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted focus:border-line focus:ring-0"
						/>

						<button
							type="button"
							disabled={!!panel.pending || !draft.trim()}
							onclick={() => comment(priority)}
							class="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
						>
							Send
						</button>
					</div>
				</div>
			{/if}
		</li>
	{:else}
		<li class="px-5 py-8 text-center text-sm text-muted">No priorities are waiting.</li>
	{/each}
</ul>

{#if reviewing}
	<div class="border-t border-line px-5 py-4">
		<p class="text-xs text-muted">Reviewing</p>
		<p class="mt-1 truncate text-sm font-medium">{reviewing.reason}</p>

		<label class="mt-3 block text-xs text-muted" for="priority-minutes">Length in minutes</label>
		<input
			id="priority-minutes"
			type="number"
			min="1"
			max="240"
			bind:value={minutes}
			class="mt-1 w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm focus:border-line focus:ring-0 pointer-coarse:min-h-11"
		/>

		<label class="mt-3 block text-xs text-muted" for="priority-message">Announcement</label>
		<textarea
			id="priority-message"
			bind:value={message}
			rows="2"
			class="mt-1 w-full resize-none rounded-lg border border-line bg-white/5 px-3 py-2 text-sm focus:border-line focus:ring-0"
		></textarea>

		<div class="mt-3 flex gap-2">
			<button
				type="button"
				disabled={!!panel.pending}
				onclick={() => decide('denied')}
				class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50 pointer-coarse:py-3"
			>
				<X class="h-4 w-4" />
				Deny
			</button>

			<button
				type="button"
				disabled={!!panel.pending}
				onclick={() => decide('accepted')}
				class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:opacity-50 pointer-coarse:py-3"
			>
				<Check class="h-4 w-4" />
				Accept
			</button>
		</div>
	</div>
{/if}
