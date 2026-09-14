<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Card from '$lib/components/settings/Card.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { defaultPunishmentTypes, punishmentPermissions } from '$lib/settings';
	import { editable } from '$lib/settingsForm.svelte';
	import { toast } from '$lib/toast.svelte';
	import type { PunishmentPreset } from './+page.server';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	let selected = $state(0);
	let creating = $state(false);
	let name = $state('');
	let channel = $state('');

	const permissionOptions = punishmentPermissions.map((level) => ({
		value: String(level.value),
		label: level.label
	}));

	const defaultChannels: Record<string, 'kick_channel' | 'ban_channel' | 'bolo_channel'> = {
		Kick: 'kick_channel',
		Ban: 'ban_channel',
		BOLO: 'bolo_channel'
	};

	const index = $derived(
		selected < defaultPunishmentTypes.length ||
			form.value.types[selected - defaultPunishmentTypes.length]
			? selected
			: 0
	);
	const builtIn = $derived(defaultPunishmentTypes[index] ?? '');
	const entry = $derived(form.value.types[index - defaultPunishmentTypes.length]);

	const trimmed = $derived(name.trim());
	const problem = $derived(
		trimmed.length < 2
			? 'Names need at least two characters.'
			: [...defaultPunishmentTypes, ...form.value.types.map((type) => type.name)].some(
						(existing) => existing.toLowerCase() === trimmed.toLowerCase()
				  )
				? `You already have a type called ${trimmed}.`
				: ''
	);

	function startCreate() {
		name = '';
		channel = '';
		creating = true;
	}

	function create() {
		form.value.types.push({ id: '', name: trimmed, channel });
		selected = defaultPunishmentTypes.length + form.value.types.length - 1;
		creating = false;
	}

	let presetOpen = $state(false);
	let presetOriginal = $state('');
	let presetName = $state('');
	let presetType = $state('');
	let presetResult = $state('');
	let presetLevel = $state(String(punishmentPermissions[0].value));
	let savingPreset = $state(false);
	let presetToDelete = $state<PunishmentPreset | null>(null);
	let deletingPreset = $state(false);

	const typeOptions = $derived(
		[
			...new Set([
				...defaultPunishmentTypes,
				...form.value.types.filter((type) => !type.remove && type.name).map((type) => type.name),
				...(presetType ? [presetType] : [])
			])
		].map((value) => ({ value, label: value }))
	);

	const presetTrimmed = $derived(presetName.trim());
	const presetProblem = $derived.by(() => {
		if (presetTrimmed.length < 2) return 'Names need at least two characters.';
		if (
			data.presets.some(
				(preset) =>
					preset.name.toLowerCase() === presetTrimmed.toLowerCase() &&
					preset.name !== presetOriginal
			)
		) {
			return `You already have a preset called ${presetTrimmed}.`;
		}
		if (!presetType) return 'Pick a punishment type.';
		if (presetResult.trim().length < 2) return 'Results need at least two characters.';
		return '';
	});

	function levelLabel(value: number): string {
		return punishmentPermissions.find((level) => level.value === value)?.label ?? 'Moderator';
	}

	function openPreset(preset?: PunishmentPreset) {
		presetOriginal = preset?.name ?? '';
		presetName = preset?.name ?? '';
		presetType = preset?.type ?? '';
		presetResult = preset?.result ?? '';
		presetLevel = String(preset?.permissionLevel ?? punishmentPermissions[0].value);
		presetOpen = true;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;
		creating = false;
		if (!savingPreset) presetOpen = false;
		if (!deletingPreset) presetToDelete = null;
	}}
/>

<div class="flex flex-col gap-6">
	<Card title="Punishments" description="How your staff moderate through ERM.">
		{#snippet action()}
			<Switch bind:checked={form.value.enabled} label="Punishments" />
		{/snippet}

		<div
			class="px-6 py-5 transition-opacity {form.value.enabled
				? ''
				: 'pointer-events-none opacity-50'}"
			inert={!form.value.enabled}
		>
			<Field
				label="Punishment Logs"
				description="Every punishment lands here unless its type sends somewhere else."
			>
				<ChannelSelect bind:value={form.value.channel} />
			</Field>
		</div>
	</Card>

	<Card
		title="Punishment Types"
		description="Warning, Kick, Ban and BOLO are always available. Add your own on top."
	>
		{#snippet action()}
			<button
				type="button"
				onclick={startCreate}
				class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Add
			</button>
		{/snippet}

		<div class="grid lg:grid-cols-[15rem_minmax(0,1fr)]">
			<ul
				class="max-h-100 overflow-y-auto border-b border-line p-2 lg:max-h-none lg:border-r lg:border-b-0"
			>
				{#each defaultPunishmentTypes as label, position (label)}
					<li>
						<button
							type="button"
							onclick={() => (selected = position)}
							aria-current={index === position ? 'true' : undefined}
							class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors pointer-coarse:py-3 {index ===
							position
								? 'bg-white/8 font-medium text-white'
								: 'text-muted hover:bg-white/5 hover:text-white'}"
						>
							<span class="flex-1 truncate">{label}</span>
							<Lock class="h-3 w-3 shrink-0 opacity-60" />
						</button>
					</li>
				{/each}

				{#each form.value.types as type, position (position)}
					{@const at = defaultPunishmentTypes.length + position}
					<li class="group relative flex items-center">
						<button
							type="button"
							onclick={() => (selected = at)}
							aria-current={index === at ? 'true' : undefined}
							class="flex w-full items-center gap-2 rounded-lg py-2 pr-9 pl-3 text-left text-sm transition-colors pointer-coarse:py-3 {index ===
							at
								? 'bg-white/8 font-medium text-white'
								: 'text-muted hover:bg-white/5 hover:text-white'}"
						>
							<span class="flex-1 truncate {type.remove ? 'text-muted/60 line-through' : ''}">
								{type.name || 'Untitled type'}
							</span>
						</button>

						<button
							type="button"
							onclick={() => (type.remove = !type.remove)}
							aria-label={type.remove ? `Keep ${type.name}` : `Delete ${type.name}`}
							class="absolute right-1 rounded-md p-1.5 text-muted transition-all hover:bg-white/10 hover:text-white focus-visible:opacity-100 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:p-3.5 {type.remove
								? 'opacity-100'
								: 'opacity-0 group-hover:opacity-100'}"
						>
							{#if type.remove}
								<Undo2 class="h-3.5 w-3.5" />
							{:else}
								<Trash2 class="h-3.5 w-3.5" />
							{/if}
						</button>
					</li>
				{/each}
			</ul>

			<div class="min-w-0 px-6 py-5">
				{#if builtIn}
					{@const key = defaultChannels[builtIn]}
					<p class="font-medium">{builtIn}</p>
					<p class="mt-1 text-sm text-muted">Built in, so it cannot be renamed or removed.</p>

					<div class="mt-5 grid gap-5 sm:grid-cols-2">
						{#if key}
							<Field label="Channel" description="Falls back to the main punishment log.">
								<ChannelSelect bind:value={form.value[key]} placeholder="Use the main log" />
							</Field>
						{:else}
							<Field label="Channel" description="Warnings always use the main punishment log.">
								<div
									class="flex min-h-10 items-center gap-2 rounded-lg border border-line bg-white/5 px-3 text-sm text-muted"
								>
									<Lock class="h-3.5 w-3.5 shrink-0" />
									Use the main log
								</div>
							</Field>
						{/if}
					</div>
				{:else if entry}
					<p class="font-medium {entry.remove ? 'text-muted line-through' : ''}">
						{entry.name || 'Untitled type'}
					</p>
					<p class="mt-1 text-sm text-muted">
						{entry.remove
							? 'Marked for deletion. Saving removes it, discarding brings it back.'
							: 'Staff can issue this the same way as the built-in types.'}
					</p>

					{#if !entry.remove}
						<div class="mt-5 grid gap-5 sm:grid-cols-2">
							<Field label="Name" description="What staff type after the punish command.">
								<Input bind:value={entry.name} maxlength={32} placeholder="Verbal Warning" />
							</Field>

							<Field label="Channel" description="Falls back to the main punishment log.">
								<ChannelSelect bind:value={entry.channel} placeholder="Use the main log" />
							</Field>
						</div>
					{/if}
				{:else}
					<p class="text-sm text-muted">No custom punishment types yet.</p>
				{/if}
			</div>
		</div>
	</Card>

	<Card
		title="Punishment Presets"
		description="Saved reasons your staff can drop into a punishment from the panel."
	>
		{#snippet action()}
			<button
				type="button"
				onclick={() => openPreset()}
				class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Add
			</button>
		{/snippet}

		{#if data.presets.length}
			<ul class="divide-y divide-line">
				{#each data.presets as preset (preset.name)}
					<li class="flex items-center gap-3 px-6 py-4">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{preset.name}</p>
							<p class="mt-1 truncate text-sm text-muted">{preset.result}</p>
						</div>

						<span class="hidden shrink-0 text-xs text-muted sm:block">
							{preset.type} · {levelLabel(preset.permissionLevel)}
						</span>

						<button
							type="button"
							onclick={() => openPreset(preset)}
							aria-label="Edit {preset.name}"
							class="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:p-3.5"
						>
							<Pencil class="h-3.5 w-3.5" />
						</button>

						<button
							type="button"
							onclick={() => (presetToDelete = preset)}
							aria-label="Delete {preset.name}"
							class="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:p-3.5"
						>
							<Trash2 class="h-3.5 w-3.5" />
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="px-6 py-5 text-sm text-muted">No presets yet.</p>
		{/if}
	</Card>
</div>

<SaveBar {form} />

{#if creating}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (creating = false)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-88 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">New punishment type</h2>
		<p class="mt-2 text-sm text-muted">It is added to your list, then created when you save.</p>

		<div class="mt-5 flex flex-col gap-5">
			<Field
				label="Name"
				description="What staff type after the punish command."
				counter="{trimmed.length}/32"
			>
				<Input bind:value={name} maxlength={32} placeholder="Verbal Warning" />
			</Field>

			<Field label="Channel" description="Falls back to the main punishment log.">
				<ChannelSelect bind:value={channel} placeholder="Use the main log" />
			</Field>
		</div>

		{#if problem && trimmed}
			<p class="mt-3 text-sm text-red-400">{problem}</p>
		{/if}

		<div class="mt-6 flex gap-2">
			<button
				type="button"
				onclick={() => (creating = false)}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={create}
				disabled={!!problem}
				class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				Add type
			</button>
		</div>
	</div>
{/if}

{#if presetOpen}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => !savingPreset && (presetOpen = false)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-md max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">{presetOriginal ? 'Edit preset' : 'New preset'}</h2>
		<p class="mt-2 text-sm text-muted">
			Staff pick presets while punishing to fill in the reason for them.
		</p>

		<form
			method="POST"
			action="?/savePreset"
			use:enhance={() => {
				savingPreset = true;

				return async ({ result }) => {
					savingPreset = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not save that preset.'), 'error');
						return;
					}

					presetOpen = false;
					await invalidateAll();
					toast(presetOriginal ? 'Preset updated.' : 'Preset created.', 'success');
				};
			}}
		>
			<input type="hidden" name="oldName" value={presetOriginal} />
			<input type="hidden" name="name" value={presetName} />
			<input type="hidden" name="type" value={presetType} />
			<input type="hidden" name="permissionLevel" value={presetLevel} />

			<div class="mt-5 flex flex-col gap-5">
				<Field
					label="Name"
					description="What staff search for when picking a preset."
					counter="{presetTrimmed.length}/32"
				>
					<Input bind:value={presetName} maxlength={32} placeholder="Speeding" />
				</Field>

				<Field label="Type" description="The punishment this preset is issued as.">
					<Select options={typeOptions} bind:value={presetType} placeholder="Pick a type" />
				</Field>

				<Field
					label="Result"
					description="The reason dropped into the punishment."
					counter="{presetResult.trim().length}/500"
				>
					<textarea
						name="result"
						bind:value={presetResult}
						rows="3"
						maxlength={500}
						placeholder="Speeding over 100 mph"
						class="w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted focus:ring-0"
					></textarea>
				</Field>

				<Field label="Permission Level" description="The lowest rank that can use this preset.">
					<Select options={permissionOptions} bind:value={presetLevel} />
				</Field>
			</div>

			{#if presetProblem && presetTrimmed}
				<p class="mt-3 text-sm text-red-400">{presetProblem}</p>
			{/if}

			<div class="mt-6 flex gap-2">
				<button
					type="button"
					onclick={() => (presetOpen = false)}
					disabled={savingPreset}
					class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={savingPreset || !!presetProblem}
					class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{savingPreset ? 'Saving...' : presetOriginal ? 'Save changes' : 'Add preset'}
				</button>
			</div>
		</form>
	</div>
{/if}

{#if presetToDelete}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => !deletingPreset && (presetToDelete = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-md max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">Delete this preset?</h2>
		<p class="mt-2 text-sm text-muted">
			{presetToDelete.name} stops showing up when your staff punish someone. Punishments already issued
			with it are left alone.
		</p>

		<form
			method="POST"
			action="?/deletePreset"
			use:enhance={() => {
				deletingPreset = true;

				return async ({ result }) => {
					deletingPreset = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not delete that preset.'), 'error');
						return;
					}

					presetToDelete = null;
					await invalidateAll();
					toast('Preset deleted.', 'success');
				};
			}}
			class="mt-6 flex gap-2"
		>
			<input type="hidden" name="name" value={presetToDelete.name} />
			<button
				type="button"
				onclick={() => (presetToDelete = null)}
				disabled={deletingPreset}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={deletingPreset}
				class="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				{deletingPreset ? 'Deleting...' : 'Delete'}
			</button>
		</form>
	</div>
{/if}
