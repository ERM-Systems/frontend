<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { fly } from 'svelte/transition';
	import { defaultAvatar } from '$lib/staff';
	import type { MemberResult } from '$lib/server/staff';

	let {
		guildId,
		member = $bindable(),
		placeholder = 'Search by username'
	}: {
		guildId: string;
		member: MemberResult | null;
		placeholder?: string;
	} = $props();

	let query = $state('');
	let results = $state<MemberResult[]>([]);
	let searching = $state(false);
	let focused = $state(false);

	let timer: ReturnType<typeof setTimeout> | undefined;

	function search(term: string) {
		clearTimeout(timer);

		if (term.trim().length < 2) {
			results = [];
			return;
		}

		timer = setTimeout(async () => {
			searching = true;

			try {
				const response = await fetch(
					`/${guildId}/dashboard/staff-management/lookup?query=${encodeURIComponent(term.trim())}`
				);
				const body = await response.json();
				results = Array.isArray(body.members) ? body.members.slice(0, 5) : [];
			} catch {
				results = [];
			} finally {
				searching = false;
			}
		}, 250);
	}

	function choose(result: MemberResult) {
		member = result;
		query = '';
		results = [];
	}
</script>

{#if member}
	{@const userId = member.userId}
	<div class="flex items-center gap-3 rounded-lg border border-line bg-white/5 px-3 py-2">
		<img
			src={member.avatarUrl || defaultAvatar(userId)}
			alt=""
			onerror={(event) => {
				const image = event.currentTarget as HTMLImageElement;
				const fallback = defaultAvatar(userId);
				if (image.src !== fallback) image.src = fallback;
			}}
			class="h-7 w-7 shrink-0 rounded-lg bg-white/8 object-cover"
		/>

		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-medium">{member.displayName || member.username}</p>
			<p class="truncate font-mono text-xs text-muted">{member.userId}</p>
		</div>

		<button
			type="button"
			onclick={() => (member = null)}
			aria-label="Pick a different member"
			class="tap shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-white/10 hover:text-white"
		>
			<X class="h-4 w-4" />
		</button>
	</div>
{:else}
	<div class="relative">
		<div class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3">
			<Search class="h-4 w-4 shrink-0 text-muted" />
			<input
				bind:value={query}
				oninput={() => search(query)}
				onfocus={() => (focused = true)}
				onblur={() => setTimeout(() => (focused = false), 150)}
				{placeholder}
				aria-label={placeholder}
				autocomplete="off"
				class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
			/>
		</div>

		{#if focused && query.trim().length >= 2}
			<div
				class="absolute top-full right-0 left-0 z-60 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
				transition:fly={{ y: -6, duration: 150 }}
			>
				{#if results.length}
					<ul class="p-1">
						{#each results as result (result.userId)}
							<li>
								<button
									type="button"
									onclick={() => choose(result)}
									class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5"
								>
									<img
										src={result.avatarUrl || defaultAvatar(result.userId)}
										alt=""
										onerror={(event) => {
											const image = event.currentTarget as HTMLImageElement;
											const fallback = defaultAvatar(result.userId);
											if (image.src !== fallback) image.src = fallback;
										}}
										class="h-6 w-6 shrink-0 rounded bg-white/8 object-cover"
									/>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm"
											>{result.displayName || result.username}</span
										>
										<span class="block truncate text-xs text-muted">{result.username}</span>
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="px-3 py-6 text-center text-sm text-muted">
						{searching ? 'Searching...' : 'No members match that search.'}
					</p>
				{/if}
			</div>
		{/if}
	</div>
{/if}
