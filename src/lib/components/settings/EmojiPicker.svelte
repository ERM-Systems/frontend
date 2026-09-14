<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { fly } from 'svelte/transition';
	import type { EmojiGroup } from '$lib/emoji';

	let { value = $bindable(''), label = 'Emoji' }: { value: string; label?: string } = $props();

	let open = $state(false);
	let query = $state('');
	let groups = $state<EmojiGroup[]>([]);
	let host = $state<HTMLDivElement>();

	const results = $derived.by(() => {
		const term = query.trim().toLowerCase();
		if (!term) return groups;

		return groups
			.map((group) => ({
				name: group.name,
				emojis: group.emojis.filter((entry) => entry.name.includes(term))
			}))
			.filter((group) => group.emojis.length);
	});

	async function toggle() {
		open = !open;
		query = '';

		if (open && !groups.length) groups = (await import('$lib/emoji')).emojiGroups;
	}

	function choose(next: string) {
		value = next;
		open = false;
	}
</script>

/

<svelte:window
	onkeydown={(event) => event.key === 'Escape' && (open = false)}
	onpointerdown={(event) => {
		if (open && host && !host.contains(event.target as Node)) open = false;
	}}
/>

<div class="relative" bind:this={host}>
	<button
		type="button"
		onclick={toggle}
		aria-haspopup="true"
		aria-expanded={open}
		aria-label={label}
		class="w-full rounded-lg border border-line bg-white/5 px-3 py-2.5 text-center text-sm transition-colors hover:bg-white/8 {value
			? ''
			: 'opacity-40'}"
	>
		{value || '📘'}
	</button>

	{#if open}
		<div
			class="absolute top-full left-0 z-60 mt-2 flex w-72 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
			transition:fly={{ y: -4, duration: 120 }}
		>
			<div class="flex items-center gap-2 border-b border-line px-3">
				<Search class="h-4 w-4 shrink-0 text-muted" />
				<input
					bind:value={query}
					placeholder="Search emoji"
					aria-label="Search emoji"
					class="w-full border-0 bg-transparent px-0 py-2.5 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
				/>
				<button
					type="button"
					onclick={() => choose('')}
					aria-label="No emoji"
					class="shrink-0 rounded p-1 text-muted transition-colors hover:bg-white/10 hover:text-white"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</div>

			<div class="max-h-64 min-h-0 overflow-y-auto p-2">
				{#each results as group (group.name)}
					<p class="px-1 pt-2 pb-1 text-xs font-medium text-muted first:pt-0">{group.name}</p>

					<div class="grid grid-cols-8">
						{#each group.emojis as entry (entry.char)}
							<button
								type="button"
								onclick={() => choose(entry.char)}
								aria-label={entry.name}
								aria-pressed={value === entry.char}
								class="h-8 rounded-md text-lg transition-colors hover:bg-white/8 {value ===
								entry.char
									? 'bg-white/10'
									: ''}"
							>
								{entry.char}
							</button>
						{/each}
					</div>
				{:else}
					<p class="px-3 py-6 text-center text-sm text-muted">Nothing matches "{query}".</p>
				{/each}
			</div>
		</div>
	{/if}
</div>
