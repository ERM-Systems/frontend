<script lang="ts">
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Field from '$lib/components/settings/Field.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import { toast } from '$lib/toast.svelte';
	import MemberSearch from './MemberSearch.svelte';
	import type { MemberResult } from '$lib/server/staff';

	export interface Escalation {
		threshold: number;
		next: string;
	}

	let {
		open = $bindable(false),
		guildId,
		types,
		escalations,
		fixedMember = null
	}: {
		open: boolean;
		guildId: string;
		types: string[];
		escalations: Record<string, Escalation>;
		fixedMember?: MemberResult | null;
	} = $props();

	let member = $state<MemberResult | null>(null);
	let type = $state('');
	let reason = $state('');
	let saving = $state(false);
	let counts = $state<Record<string, number>>({});

	const target = $derived(fixedMember ?? member);

	const options = $derived(types.filter(Boolean).map((value) => ({ value, label: value })));

	const trimmed = $derived(reason.trim());

	const problem = $derived.by(() => {
		if (!target) return 'Pick a member to infract.';
		if (!type) return 'Pick an infraction type.';
		if (trimmed.length < 2) return 'Give a reason of at least 2 characters.';
		if (trimmed.length > 1000) return 'That reason is too long.';
		return '';
	});

	const preview = $derived.by(() => {
		if (!target || !type) return null;

		const escalation = escalations[type];
		const held = counts[type] ?? 0;
		if (!escalation?.next) return { held, escalates: false, next: '' };

		return {
			held,
			escalates: held + 1 >= escalation.threshold,
			next: escalation.next
		};
	});

	$effect(() => {
		const userId = target?.userId;
		if (!open || !userId) return;

		let active = true;

		fetch(`/${guildId}/dashboard/staff-management/lookup?userId=${userId}`)
			.then((response) => response.json())
			.then((body) => {
				if (active) counts = body.counts ?? {};
			})
			.catch(() => {});

		return () => {
			active = false;
		};
	});

	function close() {
		if (saving) return;

		open = false;
		member = null;
		type = '';
		reason = '';
		counts = {};
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={close}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-md max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">Issue an infraction</h2>
		<p class="mt-2 text-sm text-muted">
			This records the infraction and posts it to Discord exactly as the bot would.
		</p>

		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				saving = true;

				return async ({ result }) => {
					saving = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not issue that infraction.'), 'error');
						return;
					}

					close();
					await invalidateAll();
					toast('Infraction issued.', 'success');
				};
			}}
		>
			<input type="hidden" name="userId" value={target?.userId ?? ''} />
			<input type="hidden" name="username" value={target?.username ?? ''} />
			<input type="hidden" name="type" value={type} />

			<div class="mt-5 flex flex-col gap-4">
				{#if !fixedMember}
					<Field label="Member" description="Who this infraction is against.">
						<MemberSearch {guildId} bind:member />
					</Field>
				{/if}

				<Field label="Type" description="Which infraction this counts as.">
					<Select {options} bind:value={type} placeholder="Pick a type" />
				</Field>

				<Field
					label="Reason"
					description="Why this infraction is being issued."
					counter="{trimmed.length}/1000"
				>
					<textarea
						name="reason"
						bind:value={reason}
						rows="4"
						maxlength={1000}
						placeholder="Why this infraction is being issued"
						class="w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted focus:ring-0"
					></textarea>
				</Field>
			</div>

			{#if preview}
				<div class="mt-4 rounded-lg border border-line bg-white/5 px-3 py-2.5 text-sm text-muted">
					{#if preview.escalates}
						<p class="flex items-start gap-2 text-yellow-400">
							<TrendingUp class="mt-0.5 h-4 w-4 shrink-0" />
							<span>
								They already hold {preview.held}
								active {type} infraction{preview.held === 1 ? '' : 's'}, so this one escalates to
								{preview.next}.
							</span>
						</p>
					{:else}
						<p>
							They already hold {preview.held}
							active {type} infraction{preview.held === 1 ? '' : 's'}.
							{#if preview.next}
								This one will not escalate yet.
							{/if}
						</p>
					{/if}
				</div>
			{/if}

			{#if problem && trimmed}
				<p class="mt-3 text-sm text-red-400">{problem}</p>
			{/if}

			<div class="mt-6 flex gap-2">
				<button
					type="button"
					onclick={close}
					disabled={saving}
					class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={saving || !!problem}
					class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{saving ? 'Issuing...' : 'Issue infraction'}
				</button>
			</div>
		</form>
	</div>
{/if}
