<script lang="ts">
	import AlarmClock from '@lucide/svelte/icons/alarm-clock';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import { fade, fly, slide } from 'svelte/transition';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Duration from '$lib/components/settings/Duration.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { dashboardHref } from '$lib/dashboard';
	import { guildData } from '$lib/dashboardData.svelte';
	import { integrationTypes, type Reminder } from '$lib/settings';
	import { editable } from '$lib/settingsForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	const link = (slug: string) => dashboardHref(data.guild.id, slug);

	let editing = $state<Reminder | null>(null);
	let creating = $state(false);

	const valid = $derived(
		!!editing && editing.name.trim().length >= 2 && !!editing.message.trim() && !!editing.channel
	);

	function blank(): Reminder {
		return {
			id: String(Date.now()),
			name: '',
			message: '',
			channel: '',
			role: [],
			interval: 3600,
			lastTriggered: 0,
			paused: false,
			completion_ability: false,
			integration: { type: '', content: '' }
		};
	}

	function create() {
		editing = blank();
		creating = true;
	}

	function edit(reminder: Reminder) {
		editing = structuredClone($state.snapshot(reminder));
		creating = false;
	}

	function commit() {
		if (!editing || !valid) return;

		const entry = $state.snapshot(editing) as Reminder;
		form.value.reminders = creating
			? [...form.value.reminders, entry]
			: form.value.reminders.map((item) => (item.id === entry.id ? entry : item));

		editing = null;
	}

	function remove(id: string) {
		form.value.reminders = form.value.reminders.filter((item) => item.id !== id);
	}

	function every(seconds: number): string {
		if (seconds % 86400 === 0) return `Every ${seconds / 86400} day${seconds === 86400 ? '' : 's'}`;
		if (seconds % 3600 === 0) return `Every ${seconds / 3600} hour${seconds === 3600 ? '' : 's'}`;
		return `Every ${Math.round(seconds / 60)} minutes`;
	}

	function channelName(channelId: string): string {
		const match = (guildData.channels ?? []).find((channel) => channel.id === channelId);
		return match ? `#${match.name}` : 'No channel';
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (editing = null)} />

<PageHeader description="Let ERM remind your community, so you don't have to." />

<div class="mt-8 flex flex-col gap-6">
	<Card title="Reminders" description="Each one runs on its own interval.">
		{#snippet action()}
			<button
				type="button"
				onclick={create}
				class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Add
			</button>
		{/snippet}

		{#if !form.value.reminders.length}
			<div class="px-6 py-10 text-center">
				<div
					class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
				>
					<AlarmClock class="h-5 w-5 text-muted" />
				</div>
				<p class="mt-4 font-medium">No reminders yet</p>
				<p class="mx-auto mt-1 max-w-80 text-sm text-muted">
					Post shift rules, quota warnings or anything else your staff forget, on a schedule.
				</p>
				<button
					type="button"
					onclick={create}
					class="mt-5 inline-flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
				>
					<Plus class="h-4 w-4" />
					Add reminder
				</button>
			</div>
		{:else}
			<ul class="divide-y divide-line">
				{#each form.value.reminders as reminder (reminder.id)}
					<li class="flex flex-wrap items-center gap-4 px-6 py-4">
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="truncate font-medium">{reminder.name}</span>

								{#if reminder.paused}
									<span
										class="rounded-full border border-yellow-400/25 bg-yellow-400/10 px-2 py-0.5 text-[11px] text-yellow-400"
									>
										Paused
									</span>
								{/if}

								{#if reminder.integration.type}
									<span
										class="flex items-center gap-1 rounded-full border border-line bg-white/5 px-2 py-0.5 text-[11px] text-muted"
									>
										<Gamepad2 class="h-3 w-3" />
										{reminder.integration.type}
									</span>
								{/if}
							</div>

							<p class="mt-1 truncate text-sm text-muted">
								{every(reminder.interval)} in {channelName(reminder.channel)}
							</p>
						</div>

						<div class="flex gap-2">
							<button
								type="button"
								onclick={() => (reminder.paused = !reminder.paused)}
								aria-label={reminder.paused ? 'Resume reminder' : 'Pause reminder'}
								class="rounded-lg border border-line px-3 py-2 transition-colors hover:bg-white/5 {reminder.paused
									? 'text-yellow-400'
									: 'text-muted hover:text-white'}"
							>
								{#if reminder.paused}
									<Play class="h-4 w-4" />
								{:else}
									<Pause class="h-4 w-4" />
								{/if}
							</button>

							<button
								type="button"
								onclick={() => edit(reminder)}
								class="rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-white"
							>
								Edit
							</button>

							<button
								type="button"
								onclick={() => remove(reminder.id)}
								aria-label="Delete {reminder.name}"
								class="rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 pointer-coarse:px-3.5 pointer-coarse:py-3.5"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</div>

<SaveBar {form} />

{#if editing}
	{@const entry = editing}
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
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/8">
				<AlarmClock class="h-5 w-5" />
			</div>

			<div class="min-w-0 flex-1">
				<h2 class="font-semibold">{creating ? 'Add reminder' : 'Edit reminder'}</h2>
				<p class="mt-1 text-sm text-muted">ERM posts this on a loop until you pause it.</p>
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
			<label class="block">
				<span class="text-sm text-muted">Name</span>
				<div class="mt-2">
					<Input bind:value={entry.name} maxlength={50} placeholder="Quota reminder" />
				</div>
			</label>

			<label class="mt-5 block">
				<span class="flex items-center justify-between text-sm">
					<span class="text-muted">Message</span>
					<span class="text-xs text-muted">{entry.message.length}/2000</span>
				</span>
				<div class="mt-2">
					<Input
						bind:value={entry.message}
						rows={3}
						maxlength={2000}
						placeholder="What should ERM post?"
					/>
				</div>
			</label>

			<div class="mt-5 grid gap-4 sm:grid-cols-2">
				<label class="block">
					<span class="text-sm text-muted">Channel</span>
					<div class="mt-2">
						<ChannelSelect bind:value={entry.channel} />
					</div>
				</label>

				<label class="block">
					<span class="text-sm text-muted">Every</span>
					<div class="mt-2">
						<Duration bind:seconds={entry.interval} units={['minutes', 'hours', 'days']} min={60} />
					</div>
				</label>
			</div>

			<label class="mt-5 block">
				<span class="text-sm text-muted">Mentioned roles</span>
				<div class="mt-2">
					<Roles bind:selected={entry.role} placeholder="No roles" />
				</div>
			</label>

			{#if data.linked}
				<div class="mt-5 rounded-lg border border-line bg-bg p-4">
					<div class="flex items-center gap-2">
						<Gamepad2 class="h-4 w-4 text-muted" />
						<p class="flex-1 text-sm font-medium">ER:LC integration</p>
					</div>

					<p class="mt-1 text-sm text-muted">
						Also run a command in your game server each time this fires.
					</p>

					<div class="mt-3">
						<Select
							options={integrationTypes}
							value={entry.integration.type}
							onchange={(next: string) =>
								(entry.integration.type = next as Reminder['integration']['type'])}
						/>
					</div>

					{#if entry.integration.type}
						<div class="mt-3" transition:slide={{ duration: 150 }}>
							<Input
								bind:value={entry.integration.content}
								maxlength={200}
								placeholder={entry.integration.type === 'Hint'
									? 'Shown as a hint in game'
									: 'Sent as a message in game'}
							/>
							<p class="mt-2 font-mono text-xs text-muted">
								:{entry.integration.type === 'Hint' ? 'h' : 'm'}
								{entry.integration.content || '...'}
							</p>
						</div>
					{/if}
				</div>
			{/if}

			<label class="mt-5 flex cursor-pointer items-center gap-3">
				<Switch bind:checked={entry.completion_ability} label="Completion button" />
				<span class="text-sm text-muted">
					Add a button staff can press to mark this reminder as done.
				</span>
			</label>
		</div>

		{#if !data.linked}
			<Callout tone="warning">
				Looking for our ER:LC integration? Your server hasn't been linked yet, please link it
				<a href={link('game-integration')} class="underline underline-offset-2 hover:text-white">
					here
				</a> before you can use ER:LC integrations.
			</Callout>
		{/if}

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
				{creating ? 'Add reminder' : 'Save changes'}
			</button>
		</div>
	</div>
{/if}
