<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import { ago, type Panel } from '$lib/panelClient.svelte';

	let { panel, now }: { panel: Panel; now: number } = $props();

	const requests = $derived(panel.snapshot.requests);

	const outstanding = $derived(requests.filter((request) => !request.acked.includes(panel.me)));
</script>

{#if outstanding.length > 1}
	<div class="border-b border-line px-5 py-3">
		<button
			type="button"
			disabled={!!panel.pending}
			onclick={() =>
				panel.act('ackAll', {
					action: 'request.ackAll',
					ids: outstanding.map((request) => request.id)
				})}
			class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50 pointer-coarse:py-3"
		>
			<CheckCheck class="h-4 w-4" />
			Respond to all {outstanding.length}
		</button>
	</div>
{/if}

<ul class="divide-y divide-line">
	{#each requests as request (request.id)}
		<li class="flex items-start gap-4 px-5 py-4">
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{request.username}</p>
				<p class="mt-0.5 text-sm text-muted">{request.reason}</p>
				<p class="mt-1 text-xs text-muted">
					{ago(request.createdAt, now)}{request.acked.length
						? ` - ${request.acked.length} answering`
						: ''}
				</p>
			</div>

			{#if request.acked.includes(panel.me)}
				<span
					class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-green-400/30 bg-green-400/10 px-3 py-1.5 text-xs font-semibold text-green-300"
				>
					<Check class="h-3.5 w-3.5" />
					Responded
				</span>
			{:else}
				<button
					type="button"
					disabled={!!panel.pending}
					onclick={() => panel.act(`ack:${request.id}`, { action: 'request.ack', id: request.id })}
					class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white/5 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
				>
					<Check class="h-3.5 w-3.5" />
					Respond
				</button>
			{/if}
		</li>
	{:else}
		<li class="px-5 py-8 text-center text-sm text-muted">No open staff requests.</li>
	{/each}
</ul>
