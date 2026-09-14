<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import { fly } from 'svelte/transition';
	import { placement } from '$lib/dropdown';
	import type { Role } from '$lib/server/discord';

	let {
		roles,
		selected = $bindable([]),
		placeholder = 'Select roles',
		single = false,
		onchange,
		label
	}: {
		roles: Role[];
		selected: string[];
		placeholder?: string;
		single?: boolean;
		onchange?: (selected: string[]) => void;
		label?: string;
	} = $props();

	let open = $state(false);
	let query = $state('');
	let host = $state<HTMLElement>();
	let place = $state({ up: false, max: 320 });

	function toggle_() {
		if (!open) place = placement(host);
		open = !open;
	}

	const chosen = $derived(roles.filter((role) => selected.includes(role.id)));
	const missing = $derived(selected.filter((id) => !roles.some((role) => role.id === id)));

	const limit = 3;
	const entries = $derived([
		...chosen.map((role) => ({ id: role.id, role: role as Role | null })),
		...missing.map((id) => ({ id, role: null }))
	]);
	const shown = $derived(entries.slice(0, limit));
	const hidden = $derived(entries.length - shown.length);

	const visible = $derived.by(() => {
		const term = query.trim().toLowerCase();
		if (!term) return roles;
		return roles.filter((role) => role.name.toLowerCase().includes(term));
	});

	function toggle(id: string) {
		if (single) {
			selected = selected.includes(id) ? [] : [id];
			open = false;
		} else {
			selected = selected.includes(id)
				? selected.filter((entry) => entry !== id)
				: [...selected, id];
		}

		onchange?.(selected);
	}

	function clearMissing() {
		selected = selected.filter((id) => roles.some((role) => role.id === id));
		open = false;
		onchange?.(selected);
	}

	function tint(color: number): string {
		return color ? `#${color.toString(16).padStart(6, '0')}` : '#99aab5';
	}
</script>

<svelte:window
	onkeydown={(event) => event.key === 'Escape' && (open = false)}
	onpointerdown={(event) => {
		if (open && host && !host.contains(event.target as Node)) open = false;
	}}
/>

<div class="relative {open ? 'z-50' : ''}" bind:this={host}>
	<button
		type="button"
		onclick={toggle_}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={label}
		class="flex min-h-10 w-full items-center gap-3 rounded-lg border border-line bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/8 pointer-coarse:min-h-11"
	>
		<span class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
			{#each shown as entry (entry.id)}
				{#if entry.role}
					{@const role = entry.role}
					<span
						class="flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-white/5 px-2 py-0.5 text-xs"
						style="border-color: {role.color ? `${tint(role.color)}40` : ''}"
					>
						{#if role.iconUrl}
							<img src={role.iconUrl} alt="" class="h-3.5 w-3.5 shrink-0 rounded-full" />
						{:else}
							<span class="h-2 w-2 shrink-0 rounded-full" style="background: {tint(role.color)}"
							></span>
						{/if}
						<span class="truncate" style="color: {role.color ? tint(role.color) : ''}">
							{role.name}
						</span>
					</span>
				{:else}
					<span
						class="rounded-md border border-line bg-white/5 px-2 py-0.5 text-xs text-muted"
						title="This role no longer exists in Discord"
					>
						Deleted role
					</span>
				{/if}
			{/each}

			{#if hidden > 0}
				<span class="rounded-md border border-line bg-white/5 px-2 py-0.5 text-xs text-muted">
					+{hidden} more
				</span>
			{/if}

			{#if !entries.length}
				<span class="text-sm text-muted">{placeholder}</span>
			{/if}
		</span>

		<ChevronDown
			class="h-4 w-4 shrink-0 text-muted {open ? 'rotate-180' : ''} transition-transform"
		/>
	</button>

	{#if open}
		<div
			class="absolute {place.up
				? 'bottom-full mb-2'
				: 'top-full mt-2'} right-0 left-0 z-60 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
			style="max-height: {place.max}px"
			transition:fly={{ y: -6, duration: 150 }}
		>
			{#if missing.length && roles.length}
				<div class="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
					<span class="min-w-0 flex-1 text-xs text-muted">
						{missing.length === 1
							? 'One role here no longer exists in Discord.'
							: `${missing.length} roles here no longer exist in Discord.`}
					</span>
					<button
						type="button"
						onclick={clearMissing}
						class="rounded-md border border-line px-2 py-1 text-xs font-semibold transition-colors hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 pointer-coarse:py-1.5"
					>
						Remove {missing.length === 1 ? 'it' : 'them'}
					</button>
				</div>
			{/if}

			<div class="flex items-center gap-2 border-b border-line px-3">
				<Search class="h-4 w-4 shrink-0 text-muted" />
				<input
					bind:value={query}
					placeholder="Search roles"
					aria-label="Search roles"
					class="w-full border-0 bg-transparent px-0 py-2.5 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
				/>
			</div>

			<ul class="min-h-0 flex-1 overflow-y-auto p-1" role="listbox" aria-multiselectable={!single}>
				{#each visible as role (role.id)}
					{@const active = selected.includes(role.id)}
					<li>
						<button
							type="button"
							role="option"
							aria-selected={active}
							onclick={() => toggle(role.id)}
							class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors {active
								? 'bg-white/8'
								: 'hover:bg-white/5'}"
						>
							{#if role.iconUrl}
								<img src={role.iconUrl} alt="" class="h-4 w-4 shrink-0 rounded-full" />
							{:else}
								<span class="flex h-4 w-4 shrink-0 items-center justify-center">
									<span class="h-2.5 w-2.5 rounded-full" style="background: {tint(role.color)}"
									></span>
								</span>
							{/if}
							<span
								class="flex-1 truncate"
								style="color: {role.color ? tint(role.color) : active ? '#fff' : ''}"
								class:text-muted={!role.color && !active}
							>
								{role.name}
							</span>
							{#if active}
								<Check class="h-4 w-4 shrink-0" />
							{/if}
						</button>
					</li>
				{:else}
					<li class="px-3 py-6 text-center text-sm text-muted">No roles match "{query}".</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
