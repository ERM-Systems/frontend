<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FileText from '@lucide/svelte/icons/file-text';
	import Search from '@lucide/svelte/icons/search';
	import type { Documentation } from '$lib/server/panel';

	let { documentation }: { documentation: Documentation[] } = $props();

	let query = $state('');
	let failed = $state<string[]>([]);

	const entries = $derived.by(() => {
		const term = query.trim().toLowerCase();
		if (!term) return documentation;

		return documentation.filter((entry) => entry.name.toLowerCase().includes(term));
	});
</script>

{#if documentation.length}
	<div class="border-b border-line px-5 py-4">
		<div class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3">
			<Search class="h-4 w-4 shrink-0 text-muted" />
			<input
				bind:value={query}
				placeholder="Search documentation"
				aria-label="Search documentation"
				autocomplete="off"
				class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
			/>
		</div>
	</div>
{/if}

<ul class="divide-y divide-line">
	{#each entries as entry (entry.id)}
		<li>
			<a
				href={entry.url}
				rel="noreferrer noopener"
				target="_blank"
				class="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/5"
			>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5"
				>
					{#if entry.icon && !failed.includes(entry.id)}
						<img
							src={entry.icon}
							alt=""
							width="64"
							height="64"
							loading="lazy"
							class="h-5 w-5 rounded object-contain"
							onerror={() => (failed = [...failed, entry.id])}
						/>
					{:else}
						<FileText class="h-4 w-4 text-muted" />
					{/if}
				</div>

				<span class="min-w-0 flex-1 truncate text-sm font-medium">{entry.name}</span>
				<ExternalLink class="h-4 w-4 shrink-0 text-muted" />
			</a>
		</li>
	{:else}
		<li class="px-5 py-10 text-center text-sm text-muted">
			{query ? 'Nothing matches that search.' : 'This server has no documentation linked yet.'}
		</li>
	{/each}
</ul>
