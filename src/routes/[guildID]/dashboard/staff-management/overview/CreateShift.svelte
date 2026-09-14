<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Field from '$lib/components/settings/Field.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { toast } from '$lib/toast.svelte';
	import MemberSearch from '../MemberSearch.svelte';
	import type { MemberResult } from '$lib/server/staff';

	let {
		open = $bindable(false),
		guildId,
		types
	}: {
		open: boolean;
		guildId: string;
		types: string[];
	} = $props();

	let member = $state<MemberResult | null>(null);
	let type = $state('');
	let persist = $state(false);
	let saving = $state(false);

	const options = $derived(
		(types.length ? types : ['Default']).map((value) => ({ value, label: value }))
	);

	function close() {
		if (saving) return;

		open = false;
		member = null;
		type = '';
		persist = false;
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
		<h2 class="text-lg font-semibold">Create a shift</h2>
		<p class="mt-2 text-sm text-muted">
			Puts a member on duty as if they had run the command themselves. Leave it closed to record a
			shift you can top up with time afterwards.
		</p>

		<form
			method="POST"
			action="?/createShift"
			use:enhance={() => {
				saving = true;

				return async ({ result }) => {
					saving = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not create that shift.'), 'error');
						return;
					}

					close();
					await invalidateAll();
					toast('Shift created.', 'success');
				};
			}}
		>
			<input type="hidden" name="userId" value={member?.userId ?? ''} />
			<input type="hidden" name="type" value={type} />

			<div class="mt-5 flex flex-col gap-4">
				<Field label="Member" description="Who goes on duty.">
					<MemberSearch {guildId} bind:member />
				</Field>

				<Field label="Shift type" description="Which shift type this counts as.">
					<Select {options} bind:value={type} placeholder="Pick a type" />
				</Field>

				<Field
					label="Leave the shift running"
					description="Off records a closed shift straight away."
				>
					<Switch name="persist" bind:checked={persist} />
				</Field>
			</div>

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
					disabled={saving || !member || !type}
					class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{saving ? 'Creating...' : 'Create shift'}
				</button>
			</div>
		</form>
	</div>
{/if}
