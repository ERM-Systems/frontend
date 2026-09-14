<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import { fade, fly } from 'svelte/transition';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { guildData } from '$lib/dashboardData.svelte';
	import { editable } from '$lib/settingsForm.svelte';
	import type { StatisticsChannel } from './+page.server';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	const voiceChannel = [2];

	const statisticsTokens = [
		'{players}',
		'{max_players}',
		'{queue}',
		'{onduty}',
		'{staff}',
		'{mods}',
		'{admins}',
		'{join_code}'
	];

	const overlapping = $derived(
		form.value.permission_sync.moderator_roles.filter((role) =>
			form.value.permission_sync.administrator_roles.includes(role)
		)
	);

	let editing = $state<{ index: number; entry: StatisticsChannel } | null>(null);

	const taken = $derived(
		form.value.statistics
			.filter((_, position) => position !== editing?.index)
			.map((entry) => entry.channel)
	);

	const valid = $derived(
		Boolean(editing?.entry.channel) &&
			Boolean(editing?.entry.format.trim()) &&
			!taken.includes(editing?.entry.channel ?? '')
	);

	function channelName(channel: string): string {
		const found = (guildData.channels ?? []).find((entry) => entry.id === channel);
		return found?.name ?? 'Unknown channel';
	}

	function open(index: number, entry: StatisticsChannel) {
		editing = { index, entry: structuredClone($state.snapshot(entry)) };
	}

	function addChannel() {
		open(-1, { channel: '', format: '' });
	}

	function commit() {
		if (!editing || !valid) return;

		const entry = $state.snapshot(editing.entry) as StatisticsChannel;
		const index = editing.index;

		form.value.statistics =
			index < 0
				? [...form.value.statistics, entry]
				: form.value.statistics.map((item, position) => (position === index ? entry : item));

		editing = null;
	}

	function removeChannel(index: number) {
		form.value.statistics = form.value.statistics.filter((_, position) => position !== index);
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (editing = null)} />

<PageHeader description="What ERM does inside your ER:LC server without being asked." />

<div class="mt-8 flex flex-col gap-6">
	<Card
		title="Permission Sync"
		description="Give staff their in-game permissions only while they are on duty."
	>
		{#snippet action()}
			<Switch bind:checked={form.value.permission_sync.enabled} label="Permission sync" />
		{/snippet}

		<div
			class="divide-y divide-line transition-opacity {form.value.permission_sync.enabled
				? ''
				: 'pointer-events-none opacity-50'}"
			inert={!form.value.permission_sync.enabled}
		>
			<Row
				label="Server Moderator roles"
				description="Given Server Moderator in game on duty, and stripped of it off duty or on break. Only works for staff with a linked ROBLOX account."
			>
				<Roles bind:selected={form.value.permission_sync.moderator_roles} placeholder="No roles" />
			</Row>

			<Row label="Server Administrator roles" description="The same, but for Server Administrator.">
				<Roles
					bind:selected={form.value.permission_sync.administrator_roles}
					placeholder="No roles"
				/>
			</Row>
		</div>

		{#if overlapping.length}
			<Callout tone="warning">
				{overlapping.length === 1 ? 'A role is' : `${overlapping.length} roles are`} in both lists. Anyone
				holding one gets Server Administrator, never Server Moderator.
			</Callout>
		{/if}

		<Callout>
			Staff who have not linked their Roblox account are skipped, so link with
			<code class="text-white">/link</code> before relying on this.
		</Callout>
	</Card>

	<Card
		title="Discord Checks"
		description="Message players in your server with no matching member in your Discord."
	>
		{#snippet action()}
			<Switch bind:checked={form.value.discord_checks.enabled} label="Discord checks" />
		{/snippet}

		<div
			class="divide-y divide-line transition-opacity {form.value.discord_checks.enabled
				? ''
				: 'pointer-events-none opacity-50'}"
			inert={!form.value.discord_checks.enabled}
		>
			<Row
				label="Alert channel"
				description="Where players are reported once they reach the warning count."
			>
				<ChannelSelect bind:value={form.value.discord_checks.channel_id} />
			</Row>

			<Row
				label="Warnings before reporting"
				description="How many checks a player can fail before ERM reports them in the alert channel. Zero never reports."
			>
				<Input
					type="number"
					bind:value={form.value.discord_checks.kick_after}
					min={0}
					max={10}
					suffix="checks"
				/>
			</Row>

			<Row
				label="Alert message"
				description="Sent in game every check, to every player ERM cannot match to a member."
				wide
			>
				<Input
					bind:value={form.value.discord_checks.message}
					rows={2}
					maxlength={500}
					placeholder="Please join the Private Server Communication channel."
				/>
			</Row>
		</div>

		<Callout>
			ERM checks every ten minutes and needs your server key linked to run at all. Players are
			matched by searching your members for their ROBLOX username, so a member whose Discord name
			differs is counted as missing.
		</Callout>
	</Card>

	<Card title="Statistics Channels" description="Show live server numbers in a voice channel name.">
		{#snippet action()}
			<button
				type="button"
				onclick={addChannel}
				class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Add
			</button>
		{/snippet}

		{#if !form.value.statistics.length}
			<p class="px-6 py-5 text-sm text-muted">
				No statistics channels. Add one to show your player count without anyone opening the game.
			</p>
		{:else}
			<ul class="divide-y divide-line">
				{#each form.value.statistics as entry, index (index)}
					<li class="flex items-center gap-3 px-6 py-4">
						<div class="min-w-0 flex-1">
							<span class="block truncate font-medium">{channelName(entry.channel)}</span>
							<span class="mt-1 block truncate text-sm text-muted">{entry.format}</span>
						</div>

						<button
							type="button"
							onclick={() => open(index, entry)}
							aria-label="Edit statistics channel"
							class="rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:px-3.5 pointer-coarse:py-3.5"
						>
							<Pencil class="h-4 w-4" />
						</button>

						<button
							type="button"
							onclick={() => removeChannel(index)}
							aria-label="Remove statistics channel"
							class="rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 pointer-coarse:px-3.5 pointer-coarse:py-3.5"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<Callout>Names refresh every five minutes.</Callout>
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
					{draft.index < 0 ? 'Add Statistics Channel' : 'Edit Statistics Channel'}
				</h2>
				<p class="mt-1 text-sm text-muted">
					ERM renames this channel every five minutes to match the format.
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
			<div class="flex flex-col gap-5">
				<Field label="Channel" description="Only voice channels can be renamed this way.">
					<ChannelSelect
						bind:value={draft.entry.channel}
						types={voiceChannel}
						placeholder="Pick a voice channel"
					/>
				</Field>

				{#if draft.entry.channel && taken.includes(draft.entry.channel)}
					<p class="text-sm text-yellow-400">
						That channel is already used by another statistics entry.
					</p>
				{/if}

				<Field label="Format" description="The name ERM gives the channel.">
					<Input bind:value={draft.entry.format} maxlength={100} placeholder="Players: 12/40" />
				</Field>

				<div>
					<p class="text-sm font-medium">Variables</p>
					<p class="mt-1 text-sm text-muted">
						Anything else is left in the name exactly as you typed it.
					</p>

					<div class="mt-3 flex flex-wrap gap-2">
						{#each statisticsTokens as token (token)}
							<button
								type="button"
								onclick={() => (draft.entry.format += token)}
								class="rounded-lg border border-line bg-white/5 px-2.5 py-1.5 font-mono text-xs text-muted transition-colors hover:bg-white/10 hover:text-white pointer-coarse:py-2.5"
							>
								{token}
							</button>
						{/each}
					</div>
				</div>
			</div>
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
