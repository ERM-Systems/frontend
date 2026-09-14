<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { applyAction, enhance } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import type { ResolvedPathname } from '$app/types';
	import { guildData } from '$lib/dashboardData.svelte';
	import type { Editable } from '$lib/settingsForm.svelte';
	import { toast } from '$lib/toast.svelte';

	let {
		form,
		action = '?/save',
		label = 'You have unsaved changes',
		blocked = false,
		blockedLabel = 'Finish the highlighted step first'
	}: {
		form: Editable<unknown>;
		action?: string;
		label?: string;
		blocked?: boolean;
		blockedLabel?: string;
	} = $props();

	let saving = $state(false);
	let leaving = $state<URL | null>(null);

	const held = $derived(blocked || guildData.locked);
	const heldLabel = $derived(
		guildData.locked && !blocked ? 'Checking your access to this server' : blockedLabel
	);

	function depart() {
		const target = leaving;
		leaving = null;
		if (target) goto(`${target.pathname}${target.search}${target.hash}` as ResolvedPathname);
	}

	function discard() {
		form.reset();
		depart();
	}

	beforeNavigate((navigation) => {
		if (!form.dirty || !navigation.to) return;

		navigation.cancel();
		leaving = navigation.to.url;
	});
</script>

<svelte:window onbeforeunload={(event) => form.dirty && event.preventDefault()} />

<form
	id="settings-form"
	method="POST"
	{action}
	use:enhance={() => {
		saving = true;

		return async ({ result }) => {
			saving = false;

			if (result.type === 'redirect') return applyAction(result);

			if (result.type !== 'success') {
				const reason =
					result.type === 'failure'
						? result.data?.message
						: (result.error as { message?: string } | undefined)?.message;

				toast(String(reason ?? 'Could not save your settings.'), 'error');
				return;
			}

			const returned = (result as { data?: { settings?: unknown } }).data?.settings;
			form.commit(returned ?? undefined);

			toast('Settings saved.', 'success');
			depart();
		};
	}}
>
	<input type="hidden" name="payload" value={JSON.stringify(form.value)} />
</form>

{#if form.dirty}
	<div
		class="pwa-inset-bottom fixed bottom-6 left-1/2 z-60 flex -translate-x-1/2 items-center rounded-full border border-line bg-surface p-1.5 shadow-2xl shadow-black/60"
		transition:fly={{ y: 12, duration: 180 }}
	>
		<span class="pr-3 pl-4 text-sm {held ? 'text-yellow-400' : 'text-muted'}">
			{held ? heldLabel : label}
		</span>

		<button
			type="button"
			onclick={discard}
			class="rounded-full px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
		>
			Discard
		</button>

		<button
			type="submit"
			form="settings-form"
			disabled={saving || held}
			class="ml-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
		>
			{saving ? 'Saving...' : 'Save'}
		</button>
	</div>
{/if}

{#if leaving}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">Unsaved changes</h2>
		<p class="mt-2 text-sm text-muted">
			You changed these settings but have not saved yet. What do you want to do?
		</p>

		<div class="mt-6 flex gap-2">
			<button
				type="button"
				onclick={discard}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Discard
			</button>
			<button
				type="submit"
				form="settings-form"
				disabled={saving || held}
				class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				Save
			</button>
		</div>
	</div>
{/if}
