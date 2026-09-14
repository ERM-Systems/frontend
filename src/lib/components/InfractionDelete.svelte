<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from '$lib/toast.svelte';
	import type { Infraction } from '$lib/server/staff';

	let { infraction = $bindable() }: { infraction: Infraction | null } = $props();

	let removing = $state(false);

	function close() {
		if (!removing) infraction = null;
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
		<h2 class="text-lg font-semibold">Delete this infraction?</h2>
		<p class="mt-2 text-sm text-muted">
			This removes the {infraction.type || 'infraction'} against
			{infraction.username || 'this member'} from your records. The message posted in Discord is left
			alone. This cannot be undone.
		</p>

		<form
			method="POST"
			action="?/remove"
			use:enhance={() => {
				removing = true;

				return async ({ result }) => {
					removing = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not delete that infraction.'), 'error');
						return;
					}

					infraction = null;
					await invalidateAll();
					toast('Infraction deleted.', 'success');
				};
			}}
			class="mt-6 flex gap-2"
		>
			<input type="hidden" name="infractionId" value={infraction.id} />
			<button
				type="button"
				onclick={close}
				disabled={removing}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={removing}
				class="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				{removing ? 'Deleting...' : 'Delete'}
			</button>
		</form>
	</div>
{/if}
