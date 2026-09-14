<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Field from '$lib/components/settings/Field.svelte';
	import { duration, exactTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { ShiftRecord } from '$lib/server/staff';

	let { shift = $bindable() }: { shift: ShiftRecord | null } = $props();

	let hours = $state(0);
	let minutes = $state(5);
	let seconds = $state(0);
	let busy = $state('');

	const total = $derived(Math.round(hours * 3600 + minutes * 60 + seconds));
	const onBreak = $derived(
		!!shift?.breaks.length && shift.breaks[shift.breaks.length - 1].end === 0
	);

	const shell =
		'min-h-10 w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted focus:border-white/25 focus:ring-0 pointer-coarse:min-h-11';

	function close() {
		if (busy) return;

		shift = null;
		hours = 0;
		minutes = 5;
		seconds = 0;
	}
</script>

{#if shift}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={close}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 flex max-h-[calc(100vh-4rem)] w-lg max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">Manage shift</h2>
		<p class="mt-2 text-sm text-muted">
			{shift.type || 'Default'} shift started {exactTime(shift.start)}{shift.end
				? `, ended ${exactTime(shift.end)}`
				: ', still running'}.
		</p>

		<dl class="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
			<div class="bg-surface px-4 py-3">
				<dt class="text-xs text-muted">Counted time</dt>
				<dd class="mt-0.5 font-medium">{shift.end ? duration(shift.duration) : 'Running'}</dd>
			</div>

			<div class="bg-surface px-4 py-3">
				<dt class="text-xs text-muted">Breaks</dt>
				<dd class="mt-0.5 font-medium">{shift.breaks.length}</dd>
			</div>

			<div class="bg-surface px-4 py-3">
				<dt class="text-xs text-muted">Time added</dt>
				<dd class="mt-0.5 font-medium">{duration(shift.addedTime)}</dd>
			</div>

			<div class="bg-surface px-4 py-3">
				<dt class="text-xs text-muted">Time removed</dt>
				<dd class="mt-0.5 font-medium">{duration(shift.removedTime)}</dd>
			</div>
		</dl>

		<form
			method="POST"
			action="?/addTime"
			use:enhance={({ action }) => {
				const removing = action.search === '?/removeTime';
				busy = removing ? 'remove' : 'add';

				return async ({ result }) => {
					busy = '';

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not change that shift.'), 'error');
						return;
					}

					shift = null;
					await invalidateAll();
					toast(
						removing ? 'Time removed from that shift.' : 'Time added to that shift.',
						'success'
					);
				};
			}}
			class="mt-5"
		>
			<input type="hidden" name="shiftId" value={shift.id} />

			<div class="grid grid-cols-3 gap-3">
				<Field label="Hours">
					<input type="number" name="hours" min="0" bind:value={hours} class={shell} />
				</Field>

				<Field label="Minutes">
					<input type="number" name="minutes" min="0" bind:value={minutes} class={shell} />
				</Field>

				<Field label="Seconds">
					<input type="number" name="seconds" min="0" bind:value={seconds} class={shell} />
				</Field>
			</div>

			<div class="mt-4 flex gap-2">
				<button
					type="submit"
					formaction="?/removeTime"
					disabled={!!busy || total <= 0}
					class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{busy === 'remove' ? 'Removing...' : 'Remove time'}
				</button>
				<button
					type="submit"
					disabled={!!busy || total <= 0}
					class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{busy === 'add' ? 'Adding...' : 'Add time'}
				</button>
			</div>
		</form>

		<div class="mt-6">
			<p class="text-sm font-medium">Break history</p>

			{#if !shift.breaks.length}
				<p class="mt-2 rounded-lg border border-line px-4 py-6 text-center text-sm text-muted">
					No breaks recorded on this shift.
				</p>
			{:else}
				<ul class="mt-2 divide-y divide-line rounded-lg border border-line">
					{#each shift.breaks as entry, index (index)}
						<li class="flex items-center gap-3 px-4 py-2.5">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm">
									{exactTime(entry.start)} to {entry.end ? exactTime(entry.end) : 'now'}
								</p>
								<p class="text-xs text-muted">
									{entry.end ? duration(entry.end - entry.start) : 'In progress'}
								</p>
							</div>

							{#if !entry.end}
								<span
									class="shrink-0 rounded-md border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500"
								>
									Active
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="mt-6 flex flex-wrap gap-2">
			{#if !shift.end}
				<form
					method="POST"
					action="?/toggleBreak"
					use:enhance={() => {
						busy = 'break';

						return async ({ result }) => {
							busy = '';

							if (result.type === 'failure') {
								toast(String(result.data?.message ?? 'Could not toggle that break.'), 'error');
								return;
							}

							shift = null;
							await invalidateAll();
							toast(onBreak ? 'Break ended.' : 'Break started.', 'success');
						};
					}}
					class="flex-1"
				>
					<button
						type="submit"
						disabled={!!busy}
						class="w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
					>
						{onBreak ? 'End break' : 'Start break'}
					</button>
				</form>

				<form
					method="POST"
					action="?/endShift"
					use:enhance={() => {
						busy = 'end';

						return async ({ result }) => {
							busy = '';

							if (result.type === 'failure') {
								toast(String(result.data?.message ?? 'Could not end that shift.'), 'error');
								return;
							}

							shift = null;
							await invalidateAll();
							toast('Shift ended.', 'success');
						};
					}}
					class="flex-1"
				>
					<input type="hidden" name="shiftId" value={shift.id} />
					<button
						type="submit"
						disabled={!!busy}
						class="w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
					>
						{busy === 'end' ? 'Ending...' : 'End shift'}
					</button>
				</form>
			{/if}

			<form
				method="POST"
				action="?/voidShift"
				use:enhance={() => {
					busy = 'void';

					return async ({ result }) => {
						busy = '';

						if (result.type === 'failure') {
							toast(String(result.data?.message ?? 'Could not void that shift.'), 'error');
							return;
						}

						shift = null;
						await invalidateAll();
						toast('Shift voided.', 'success');
					};
				}}
				class="flex-1"
			>
				<input type="hidden" name="shiftId" value={shift.id} />
				<button
					type="submit"
					disabled={!!busy}
					class="w-full rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{busy === 'void' ? 'Voiding...' : 'Void shift'}
				</button>
			</form>
		</div>

		<button
			type="button"
			onclick={close}
			class="mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:text-white pointer-coarse:py-3"
		>
			Close
		</button>
	</div>
{/if}
