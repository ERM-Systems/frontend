<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Field from '$lib/components/settings/Field.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import { toast } from '$lib/toast.svelte';
	import type { Infraction } from '$lib/server/staff';

	let { infraction = $bindable(), types }: { infraction: Infraction | null; types: string[] } =
		$props();

	let type = $state('');
	let reason = $state('');
	let saving = $state(false);

	$effect(() => {
		if (infraction) {
			type = infraction.type;
			reason = infraction.reason;
		}
	});

	const options = $derived(
		[...new Set([...types, ...(infraction ? [infraction.type] : [])])]
			.filter(Boolean)
			.sort()
			.map((value) => ({ value, label: value }))
	);

	const trimmed = $derived(reason.trim());

	const problem = $derived.by(() => {
		if (!type) return 'Pick an infraction type.';
		if (trimmed.length < 2) return 'Give a reason of at least 2 characters.';
		if (trimmed.length > 1000) return 'That reason is too long.';
		return '';
	});

	const unchanged = $derived(
		!!infraction && type === infraction.type && trimmed === infraction.reason.trim()
	);

	function close() {
		if (!saving) infraction = null;
	}
</script>

{#if infraction}
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
		<h2 class="text-lg font-semibold">Edit infraction</h2>
		<p class="mt-2 text-sm text-muted">
			This updates the record for {infraction.username || 'this member'} and the message posted in Discord.
			You can edit an infraction once a minute.
		</p>

		<form
			method="POST"
			action="?/edit"
			use:enhance={() => {
				saving = true;

				return async ({ result }) => {
					saving = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not edit that infraction.'), 'error');
						return;
					}

					infraction = null;
					await invalidateAll();
					toast('Infraction updated.', 'success');
				};
			}}
		>
			<input type="hidden" name="infractionId" value={infraction.id} />
			<input type="hidden" name="type" value={type} />

			<div class="mt-5 flex flex-col gap-4">
				<Field label="Type" description="Which infraction this counts as.">
					<Select {options} bind:value={type} placeholder="Pick a type" />
				</Field>

				<Field
					label="Reason"
					description="Why this infraction was issued."
					counter="{trimmed.length}/1000"
				>
					<textarea
						name="reason"
						bind:value={reason}
						rows="4"
						maxlength={1000}
						placeholder="Why this infraction was issued"
						class="w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted focus:ring-0"
					></textarea>
				</Field>
			</div>

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
					disabled={saving || !!problem || unchanged}
					class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{saving ? 'Saving...' : 'Save changes'}
				</button>
			</div>
		</form>
	</div>
{/if}
