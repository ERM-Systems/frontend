<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import { fade, fly } from 'svelte/transition';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Duration from '$lib/components/settings/Duration.svelte';
	import EmojiPicker from '$lib/components/settings/EmojiPicker.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import { permissionLevels, type PriorityPreset, type PriorityRequestType } from '$lib/settings';
	import { dashboardHref } from '$lib/dashboard';
	import { editable } from '$lib/settingsForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	const link = (slug: string) => dashboardHref(data.guild.id, slug);

	const levels = permissionLevels.map((level) => ({
		value: String(level.value),
		label: level.label
	}));

	type Draft =
		| { kind: 'preset'; index: number; entry: PriorityPreset }
		| { kind: 'request'; index: number; entry: PriorityRequestType };

	let editing = $state<Draft | null>(null);
	let emoji = $state('');

	const valid = $derived(!!editing?.entry.name.trim());

	function open(draft: Draft) {
		const entry = structuredClone($state.snapshot(draft.entry));
		const [first] = new Intl.Segmenter().segment(entry.name);
		const lead = first?.segment ?? '';

		emoji = lead && !/^[\p{L}\p{N}\p{P}\p{Z}]/u.test(lead) ? lead : '';
		entry.name = entry.name.slice(emoji.length).trimStart();
		editing = { ...draft, entry } as Draft;
	}

	function addPreset() {
		open({ kind: 'preset', index: -1, entry: { name: '', value: '', time: 600 } });
	}

	function addRequest() {
		open({
			kind: 'request',
			index: -1,
			entry: { name: '', reason: '', min_players: 0, max_players: 0, cooldown: 0 }
		});
	}

	function commit() {
		if (!editing || !valid) return;

		const trimmed = editing.entry.name.trim();
		const name = emoji ? `${emoji} ${trimmed}` : trimmed;

		if (editing.kind === 'preset') {
			const entry = { ...($state.snapshot(editing.entry) as PriorityPreset), name };
			const index = editing.index;
			form.value.presets =
				index < 0
					? [...form.value.presets, entry]
					: form.value.presets.map((item, position) => (position === index ? entry : item));
		} else {
			const entry = { ...($state.snapshot(editing.entry) as PriorityRequestType), name };
			const index = editing.index;
			form.value.request_types =
				index < 0
					? [...form.value.request_types, entry]
					: form.value.request_types.map((item, position) => (position === index ? entry : item));
		}

		editing = null;
	}

	function removePreset(index: number) {
		form.value.presets = form.value.presets.filter((_, position) => position !== index);
	}

	function removeRequest(index: number) {
		form.value.request_types = form.value.request_types.filter((_, position) => position !== index);
	}

	function duration(seconds: number): string {
		if (!seconds) return 'No duration';
		if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? '' : 's'}`;
		return `${Math.round(seconds / 60)} minutes`;
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (editing = null)} />

<PageHeader
	description="Let players request scenario time in game, and control how often it can happen."
/>

<div class="mt-8 flex flex-col gap-6">
	<Card title="Requests" description="Where priority requests go and who can send them.">
		<div class="divide-y divide-line">
			<Row label="Channel" description="Where requests are posted for review.">
				<ChannelSelect bind:value={form.value.channel_id} />
			</Row>

			<Row label="Mentioned Roles" description="Pinged whenever a request comes in.">
				<Roles bind:selected={form.value.mentioned_roles} placeholder="No roles" />
			</Row>

			<Row label="Blacklisted Roles" description="These roles can never request a priority.">
				<Roles bind:selected={form.value.blacklisted_roles} placeholder="No roles" />
			</Row>

			<Row label="Minimum Permission" description="The lowest level allowed to request.">
				<Select
					options={levels}
					value={String(form.value.minimum_allowed_permission)}
					onchange={(next: string) => (form.value.minimum_allowed_permission = Number(next))}
				/>
			</Row>
		</div>
	</Card>

	<Card title="Limits" description="Keep priorities from taking over your server.">
		<div class="divide-y divide-line">
			<Row label="Player Cooldown" description="How long one player waits between requests.">
				<Duration bind:seconds={form.value.cooldown} units={['minutes', 'hours']} />
			</Row>

			<Row
				label="Server Cooldown"
				description="How long the whole server waits between priorities."
			>
				<Duration bind:seconds={form.value.global_cooldown} units={['minutes', 'hours']} />
			</Row>

			<Row label="Peacetime" description="How long peacetime lasts once a priority ends.">
				<Duration bind:seconds={form.value.peacetimer} units={['minutes', 'hours']} />
			</Row>

			<Row label="Minimum Players" description="Requests are blocked below this player count.">
				<Input type="number" min={0} bind:value={form.value.min_players} suffix="players" />
			</Row>

			<Row
				label="Maximum Players"
				description="Requests are blocked above this player count. 0 means no limit."
			>
				<Input type="number" min={0} bind:value={form.value.max_players} suffix="players" />
			</Row>
		</div>

		<Callout>
			Player counts are read live from your ER:LC server, so both limits need a server key set in
			<a href={link('game-integration')} class="underline underline-offset-2 hover:text-white">
				Game Integration
			</a>. Leave them at 0 to skip the check.
		</Callout>
	</Card>

	<Card title="Presets" description="Common priorities your staff can start with one click.">
		{#snippet action()}
			<button
				type="button"
				onclick={addPreset}
				class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Add
			</button>
		{/snippet}

		{#if !form.value.presets.length}
			<p class="px-6 py-5 text-sm text-muted">No presets yet.</p>
		{:else}
			<ul class="divide-y divide-line">
				{#each form.value.presets as preset, index (index)}
					<li class="flex items-center gap-3 px-6 py-4">
						<div class="min-w-0 flex-1">
							<span class="block truncate font-medium">{preset.name || 'Untitled preset'}</span>
							<span class="mt-1 block truncate text-sm text-muted">
								{preset.value || 'No announcement'} &middot; {duration(preset.time)}
							</span>
						</div>

						<button
							type="button"
							onclick={() => open({ kind: 'preset', index, entry: preset })}
							aria-label="Edit preset"
							class="rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:px-3.5 pointer-coarse:py-3.5"
						>
							<Pencil class="h-4 w-4" />
						</button>

						<button
							type="button"
							onclick={() => removePreset(index)}
							aria-label="Remove preset"
							class="rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 pointer-coarse:px-3.5 pointer-coarse:py-3.5"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card title="Request Types" description="The kinds of priority a player can ask for.">
		{#snippet action()}
			<button
				type="button"
				onclick={addRequest}
				class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Add
			</button>
		{/snippet}

		{#if !form.value.request_types.length}
			<p class="px-6 py-5 text-sm text-muted">No request types yet.</p>
		{:else}
			<ul class="divide-y divide-line">
				{#each form.value.request_types as request, index (index)}
					<li class="flex items-center gap-3 px-6 py-4">
						<div class="min-w-0 flex-1">
							<span class="block truncate font-medium">{request.name || 'Untitled type'}</span>
							<span class="mt-1 block truncate text-sm text-muted">
								{request.reason || 'No reason set'}
							</span>
						</div>

						<button
							type="button"
							onclick={() => open({ kind: 'request', index, entry: request })}
							aria-label="Edit request type"
							class="rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:px-3.5 pointer-coarse:py-3.5"
						>
							<Pencil class="h-4 w-4" />
						</button>

						<button
							type="button"
							onclick={() => removeRequest(index)}
							aria-label="Remove request type"
							class="rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 pointer-coarse:px-3.5 pointer-coarse:py-3.5"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</div>

<SaveBar {form} />

{#if editing}
	{@const draft = editing}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (editing = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-125 max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<div class="flex items-start gap-4 border-b border-line px-6 py-5">
			<div class="min-w-0 flex-1">
				<h2 class="font-semibold">
					{draft.index < 0 ? 'Add' : 'Edit'}
					{draft.kind === 'preset' ? 'Preset' : 'Request Type'}
				</h2>
				<p class="mt-1 text-sm text-muted">
					{draft.kind === 'preset'
						? 'Staff can start this priority with one click.'
						: 'Players pick this when they request a priority.'}
				</p>
			</div>

			<button
				type="button"
				onclick={() => (editing = null)}
				aria-label="Close"
				class="-mt-1 -mr-2 rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-white"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<div class="max-h-[60vh] overflow-y-auto px-6 py-5">
			{#if draft.kind === 'preset'}
				{@const entry = draft.entry}
				<div class="flex flex-col gap-5">
					<div class="grid gap-4 sm:grid-cols-[5rem_1fr]">
						<Field label="Emoji">
							<EmojiPicker bind:value={emoji} />
						</Field>

						<Field label="Name" description="How staff see this preset in the menu.">
							<Input bind:value={entry.name} maxlength={32} placeholder="Bank robbery" />
						</Field>
					</div>

					<Field label="Announced As" description="The text posted when this priority starts.">
						<Input bind:value={entry.value} maxlength={64} placeholder="Bank robbery in progress" />
					</Field>

					<Field label="Duration" description="How long the priority runs before it ends.">
						<Duration bind:seconds={entry.time} units={['minutes', 'hours']} />
					</Field>
				</div>
			{:else}
				{@const entry = draft.entry}
				<div class="flex flex-col gap-5">
					<div class="grid gap-4 sm:grid-cols-[5rem_1fr]">
						<Field label="Emoji">
							<EmojiPicker bind:value={emoji} />
						</Field>

						<Field label="Name" description="How players see this type when requesting.">
							<Input bind:value={entry.name} maxlength={32} placeholder="Robbery" />
						</Field>
					</div>

					<Field label="Reason shown to players" description="Explains what this type is for.">
						<Input bind:value={entry.reason} maxlength={200} placeholder="What this is for" />
					</Field>

					<div class="grid gap-4 sm:grid-cols-2">
						<Field label="Minimum Players" description="Blocked below this count.">
							<Input type="number" min={0} bind:value={entry.min_players} />
						</Field>

						<Field label="Maximum Players" description="Blocked above it. 0 means no limit.">
							<Input type="number" min={0} bind:value={entry.max_players} />
						</Field>
					</div>

					<Field label="Cooldown" description="How long players wait before requesting this again.">
						<Duration bind:seconds={entry.cooldown} units={['minutes', 'hours']} />
					</Field>
				</div>
			{/if}
		</div>

		<div class="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
			<button
				type="button"
				onclick={() => (editing = null)}
				class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={commit}
				disabled={!valid}
				class="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				{draft.index < 0 ? 'Add' : 'Save changes'}
			</button>
		</div>
	</div>
{/if}
