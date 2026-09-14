<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from '$lib/toast.svelte';
	import type { Infraction } from '$lib/server/staff';

	let { infraction = $bindable() }: { infraction: Infraction | null } = $props();

	let revoking = $state(false);

	function close() {
		if (!revoking) infraction = null;
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
		<h2 class="text-lg font-semibold">Revoke this infraction?</h2>
		<p class="mt-2 text-sm text-muted">
			This marks the {infraction.type || 'infraction'} against
			{infraction.username || 'this member'} as revoked and keeps it in their history. Any roles it changed
			are put back.
		</p>

		<form
			method="POST"
			action="?/revoke"
			use:enhance={() => {
				revoking = true;

				return async ({ result }) => {
					revoking = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not revoke that infraction.'), 'error');
						return;
					}

					infraction = null;
					await invalidateAll();
					toast('Infraction revoked.', 'success');
				};
			}}
			class="mt-6 flex gap-2"
		>
			<input type="hidden" name="infractionId" value={infraction.id} />
			<button
				type="button"
				onclick={close}
				disabled={revoking}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={revoking}
				class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				{revoking ? 'Revoking...' : 'Revoke'}
			</button>
		</form>
	</div>
{/if}
