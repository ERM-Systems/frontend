<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import { fade, fly } from 'svelte/transition';
	import { guildData } from '$lib/dashboardData.svelte';
	import MessageEditor from '$lib/components/discord/MessageEditor.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import type { DiscordMessage } from '$lib/discord';
	import { blankInfraction, infractionVariables, type InfractionRoleChange } from '$lib/settings';
	import { editable } from '$lib/settingsForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	let selected = $state(0);
	let creating = $state(false);
	let name = $state('');

	let editorOpen = $state(false);
	let editorTitle = $state('');
	let editorMessage = $state<DiscordMessage | null>(null);

	function openEditor(message: DiscordMessage, title: string) {
		editorMessage = message;
		editorTitle = title;
		editorOpen = true;
	}

	const list = $derived(form.value.infractions);
	const index = $derived(selected < list.length ? selected : 0);
	const entry = $derived(list[index]);

	const trimmed = $derived(name.trim());
	const problem = $derived(
		trimmed.length < 2
			? 'Names need at least two characters.'
			: list.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())
				? `You already have an infraction called ${trimmed}.`
				: ''
	);

	const escalationOptions = $derived([
		{ value: '', label: 'No escalation' },
		...list
			.filter((item) => entry && item.id !== entry.id && item.name.trim())
			.map((item) => ({ value: item.name, label: item.name }))
	]);

	function nextId(): number {
		return Math.max(0, ...list.map((item) => item.id)) + 1;
	}

	function startCreate() {
		name = '';
		creating = true;
	}

	function create() {
		form.value.infractions.push(blankInfraction(nextId(), trimmed));
		selected = form.value.infractions.length - 1;
		creating = false;
	}

	function remove(position: number) {
		form.value.infractions.splice(position, 1);
		if (selected >= form.value.infractions.length) {
			selected = Math.max(0, form.value.infractions.length - 1);
		}
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (creating = false)} />

<svelte:head><title>Manage Infractions - {guildData.name}</title></svelte:head>

<div class="flex flex-col gap-6">
	<Card
		title="Infraction Types"
		description="The infractions your staff can issue, and what each one does when handed out."
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

		{#if !list.length}
			<div class="px-6 py-12 text-center">
				<div
					class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
				>
					<ShieldAlert class="h-5 w-5 text-muted" />
				</div>
				<p class="mt-4 font-medium">No infraction types yet</p>
				<p class="mx-auto mt-1 max-w-96 text-sm text-muted">
					Add your first type, like Warning or Strike, to start issuing infractions.
				</p>
			</div>
		{:else}
			<div class="grid lg:grid-cols-[16rem_minmax(0,1fr)]">
				<ul
					class="max-h-100 overflow-y-auto border-b border-line p-2 lg:max-h-none lg:border-r lg:border-b-0"
				>
					{#each list as item, position (item.id)}
						<li class="group relative flex items-center">
							<button
								type="button"
								onclick={() => (selected = position)}
								aria-current={index === position ? 'true' : undefined}
								class="flex w-full items-center gap-2 rounded-lg py-2 pr-9 pl-3 text-left text-sm transition-colors pointer-coarse:py-3 {index ===
								position
									? 'bg-white/8 font-medium text-white'
									: 'text-muted hover:bg-white/5 hover:text-white'}"
							>
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="truncate">{item.name || 'Untitled type'}</span>
									{#if item.escalation.next_infraction}
										<span class="mt-0.5 flex items-center gap-1 text-xs text-muted">
											<TrendingUp class="h-3 w-3 shrink-0" />
											<span class="truncate">Escalates to {item.escalation.next_infraction}</span>
										</span>
									{/if}
								</span>
							</button>

							<button
								type="button"
								onclick={() => remove(position)}
								aria-label="Delete {item.name || 'this type'}"
								class="absolute right-1 rounded-md p-1.5 text-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-white focus-visible:opacity-100 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:p-3.5"
							>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						</li>
					{/each}
				</ul>

				{#if entry}
					{@const current = entry}
					<div class="min-w-0">
						<div class="border-b border-line px-6 py-5">
							<div class="grid gap-5 sm:grid-cols-2">
								<Field label="Name" description="What staff type after the infraction command.">
									<Input bind:value={current.name} maxlength={32} placeholder="Warning" />
								</Field>

								<Field
									label="Escalates to"
									description="Issued automatically once the threshold is reached."
								>
									<Select
										options={escalationOptions}
										bind:value={current.escalation.next_infraction}
										placeholder="No escalation"
									/>
								</Field>

								{#if current.escalation.next_infraction}
									<Field
										label="Escalation threshold"
										description="How many of this infraction before it escalates."
									>
										<Input
											type="number"
											min={1}
											bind:value={current.escalation.threshold}
											suffix="issued"
										/>
									</Field>
								{/if}
							</div>
						</div>

						<div class="border-b border-line px-6 py-5">
							<p class="text-sm font-semibold tracking-wide text-white">Permissions</p>
							<p class="mt-1 text-sm text-muted">Which roles can issue this infraction.</p>

							<div class="mt-4">
								<Roles bind:selected={current.manager_roles} placeholder="No roles" />
							</div>
						</div>

						<Row
							label="Remove in-game permissions"
							description="Strips the member's in-game admin permissions when issued."
							tight
						>
							<Switch
								bind:checked={current.remove_ingame_perms}
								label="Remove in-game permissions"
							/>
						</Row>

						<Row
							label="End active shift"
							description="Ends the member's current shift when this is issued."
							tight
						>
							<Switch bind:checked={current.end_shift} label="End active shift" />
						</Row>

						<div class="border-t border-line px-6 py-5">
							<p class="text-sm font-semibold tracking-wide text-white">Role changes</p>
							<p class="mt-1 text-sm text-muted">
								Adjust the member's roles when this infraction is issued.
							</p>

							<div class="mt-5 grid gap-6 lg:grid-cols-2">
								{@render roleChange('Add roles', current.role_changes.add)}
								{@render roleChange('Remove roles', current.role_changes.remove)}
							</div>
						</div>

						<div class="border-t border-line px-6 py-5">
							<div class="flex items-center justify-between gap-4">
								<div class="min-w-0">
									<p class="text-sm font-semibold tracking-wide text-white">Automatic expiry</p>
									<p class="mt-1 text-sm text-muted">
										Clear this infraction after a set number of days.
									</p>
								</div>
								<Switch bind:checked={current.expiry.enabled} label="Automatic expiry" />
							</div>

							{#if current.expiry.enabled}
								<div class="mt-5 sm:max-w-72">
									<Field label="Expires after">
										<Input
											type="number"
											min={1}
											bind:value={current.expiry.duration}
											suffix="days"
										/>
									</Field>
								</div>
							{/if}
						</div>

						<div class="border-t border-line px-6 py-5">
							<p class="text-sm font-semibold tracking-wide text-white">Notifications</p>
							<p class="mt-1 text-sm text-muted">
								Let the member know when this infraction is issued.
							</p>

							<div class="mt-5 flex flex-col gap-6">
								<div>
									<div class="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
										<div class="min-w-40 flex-1">
											<p class="font-medium">Direct message</p>
											<p class="mt-1 text-sm text-muted">Sent privately to the member.</p>
										</div>
										<div class="flex shrink-0 items-center gap-3">
											{#if current.notifications.dm.enabled}
												{@render editButton(
													current.notifications.dm.message,
													`${current.name || 'Infraction'} direct message`
												)}
											{/if}
											<Switch
												bind:checked={current.notifications.dm.enabled}
												label="Direct message"
											/>
										</div>
									</div>
								</div>

								<div>
									<div class="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
										<div class="min-w-40 flex-1">
											<p class="font-medium">Public announcement</p>
											<p class="mt-1 text-sm text-muted">
												Posted to a channel for everyone to see.
											</p>
										</div>
										<div class="flex shrink-0 items-center gap-3">
											{#if current.notifications.public.enabled}
												{@render editButton(
													current.notifications.public.message,
													`${current.name || 'Infraction'} public announcement`
												)}
											{/if}
											<Switch
												bind:checked={current.notifications.public.enabled}
												label="Public announcement"
											/>
										</div>
									</div>

									{#if current.notifications.public.enabled}
										<div class="mt-4">
											<Field label="Channel">
												<ChannelSelect bind:value={current.notifications.public.channel_id} />
											</Field>
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</Card>
</div>

{#snippet editButton(message: DiscordMessage, title: string)}
	<button
		type="button"
		onclick={() => openEditor(message, title)}
		class="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
	>
		<Pencil class="h-3.5 w-3.5" />
		Edit message
	</button>
{/snippet}

{#snippet roleChange(label: string, change: InfractionRoleChange)}
	<div class="rounded-xl border border-line bg-white/2 p-4">
		<p class="text-sm font-medium">{label}</p>

		<div class="mt-3 flex flex-col gap-4">
			<Roles bind:selected={change.roles} placeholder="No roles" />

			<div class="flex items-center justify-between gap-4">
				<div class="min-w-0">
					<p class="text-sm font-medium">Temporary</p>
					<p class="mt-1 text-sm text-muted">Reverse the change automatically after a while.</p>
				</div>
				<Switch bind:checked={change.temporary} label="{label} temporary" />
			</div>

			{#if change.temporary}
				<Field label="Reverses after">
					<Input type="number" min={1} bind:value={change.duration} suffix="days" />
				</Field>
			{/if}
		</div>
	</div>
{/snippet}

<SaveBar {form} />

{#if editorMessage}
	<MessageEditor
		bind:open={editorOpen}
		message={editorMessage}
		title={editorTitle}
		variables={infractionVariables}
	/>
{/if}

{#if creating}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (creating = false)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-md max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">New infraction type</h2>
		<p class="mt-2 text-sm text-muted">It is added to your list, then created when you save.</p>

		<div class="mt-5">
			<Field
				label="Name"
				description="What staff type after the infraction command."
				counter="{trimmed.length}/32"
			>
				<Input bind:value={name} maxlength={32} placeholder="Warning" />
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
