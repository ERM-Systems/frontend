<script lang="ts">
	import Info from '@lucide/svelte/icons/info';
	import { fade } from 'svelte/transition';
	import { precise, type Panel } from '$lib/panelClient.svelte';
	import { discordFallbackAvatar, moderationDetails } from '$lib/panel';
	import type { Moderation, ModerationDetail } from '$lib/server/panel';

	let { panel, entry }: { panel: Panel; entry: Moderation } = $props();

	let host = $state<HTMLElement>();
	let card = $state<HTMLElement>();
	let open = $state(false);
	let leaving: ReturnType<typeof setTimeout> | null = null;
	let spot = $state({ place: 'top: 0px', left: 0, width: 320, max: 0 });
	let detail = $state<ModerationDetail | null>(null);
	let loading = $state(false);

	const width = 320;
	const margin = 8;
	const minSpace = 240;

	async function load() {
		if (detail || loading) return;

		const key = `${entry.userId}:${entry.moderatorId}`;
		const known = moderationDetails.get(key);

		if (known) {
			detail = known;
			return;
		}

		loading = true;

		try {
			const response = await fetch(
				`${panel.base}?feed=detail&id=${encodeURIComponent(entry.userId)}&moderatorId=${encodeURIComponent(entry.moderatorId)}`
			);

			detail = response.ok ? ((await response.json()) as ModerationDetail) : null;
			if (detail) moderationDetails.set(key, detail);
		} catch {
			detail = null;
		} finally {
			loading = false;
		}
	}

	function hold() {
		if (!leaving) return;

		clearTimeout(leaving);
		leaving = null;
	}

	function show() {
		if (!host) return;

		hold();

		const rect = host.getBoundingClientRect();
		const box = Math.min(width, window.innerWidth - margin * 2);
		const below = window.innerHeight - rect.bottom - margin;
		const above = rect.top - margin;
		const flip = below < minSpace && above > below;

		spot = {
			place: flip ? `bottom: ${window.innerHeight - rect.top + 4}px` : `top: ${rect.bottom + 4}px`,
			left: Math.max(margin, Math.min(rect.right - box, window.innerWidth - box - margin)),
			width: box,
			max: Math.max(minSpace, (flip ? above : below) - 4)
		};

		open = true;
		void load();
	}

	function hide() {
		hold();
		leaving = setTimeout(() => (open = false), 160);
	}

	const coarse = () => matchMedia('(pointer: coarse)').matches;

	function toggle() {
		if (!coarse()) return;

		if (open) {
			hold();
			open = false;
			return;
		}

		show();
	}

	function outside(event: PointerEvent) {
		if (!open || !coarse()) return;

		const target = event.target as Node;
		if (host?.contains(target) || card?.contains(target)) return;

		hold();
		open = false;
	}
</script>

<svelte:window onpointerdown={outside} />

<span
	bind:this={host}
	role="presentation"
	onpointerenter={() => !coarse() && show()}
	onpointerleave={() => !coarse() && hide()}
	onfocusin={() => !coarse() && show()}
	onfocusout={() => !coarse() && hide()}
	class="inline-flex"
>
	<button
		type="button"
		onclick={toggle}
		aria-expanded={open}
		aria-label="Details for the {entry.type} against {entry.username}"
		class="tap rounded p-1.5 text-muted transition-colors hover:bg-white/8 hover:text-white"
	>
		<Info class="h-4 w-4" />
	</button>
</span>

{#if open}
	<div
		bind:this={card}
		role="tooltip"
		style="{spot.place}; left: {spot.left}px; width: {spot.width}px; max-height: {spot.max}px"
		onpointerenter={() => !coarse() && hold()}
		onpointerleave={() => !coarse() && hide()}
		transition:fade={{ duration: 110 }}
		class="no-scrollbar fixed z-100 overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-2xl shadow-black/60"
	>
		<div class="flex items-start gap-3">
			{#if detail?.avatarUrl}
				<img
					src={detail.avatarUrl}
					alt=""
					class="settled h-12 w-12 shrink-0 rounded-lg border border-line bg-white/5 object-cover"
				/>
			{:else}
				<div
					class="h-12 w-12 shrink-0 rounded-lg border border-line bg-white/10 {loading
						? 'skeleton'
						: ''}"
				></div>
			{/if}

			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-semibold">{entry.username}</p>
				<p class="truncate text-xs text-muted">Roblox ID {entry.userId || 'unknown'}</p>
			</div>
		</div>

		<div class="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
			{#if detail?.moderatorAvatarUrl}
				<img
					src={detail.moderatorAvatarUrl}
					alt=""
					onerror={(event) =>
						((event.currentTarget as HTMLImageElement).src = discordFallbackAvatar)}
					class="settled h-8 w-8 shrink-0 rounded-full border border-line bg-white/5 object-cover"
				/>
			{:else}
				<div
					class="h-8 w-8 shrink-0 rounded-full border border-line bg-white/10 {loading
						? 'skeleton'
						: ''}"
				></div>
			{/if}

			<div class="min-w-0 flex-1">
				{#if loading}
					<span class="skeleton block h-3 w-32 rounded bg-white/10"></span>
					<span class="skeleton mt-1.5 block h-2.5 w-40 rounded bg-white/10"></span>
				{:else}
					<p class="truncate text-xs font-medium">
						Logged by {detail?.moderatorName || entry.moderator}
					</p>
					<p class="truncate text-[11px] text-muted">
						Discord ID {entry.moderatorId || 'unknown'}
					</p>
				{/if}
			</div>
		</div>

		<dl class="mt-3 space-y-2 border-t border-line pt-3 text-xs">
			<div>
				<dt class="text-muted">Logged</dt>
				<dd class="mt-0.5">{precise(entry.epoch)}</dd>
			</div>

			{#if entry.untilEpoch}
				<div>
					<dt class="text-muted">Expires</dt>
					<dd class="mt-0.5">{precise(entry.untilEpoch)}</dd>
				</div>
			{/if}

			<div>
				<dt class="text-muted">Reason</dt>
				<dd class="mt-0.5 wrap-break-word">{entry.reason}</dd>
			</div>

			<div>
				<dt class="text-muted">Moderation ID</dt>
				<dd class="mt-0.5 font-mono break-all">{entry.id}</dd>
			</div>
		</dl>
	</div>
{/if}
