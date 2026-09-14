<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import Modal from '$lib/components/Modal.svelte';
	import Field from './Field.svelte';
	import Input from './Input.svelte';
	import Roles from './Roles.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import {
		groupGranted,
		grantedCount,
		maxRoleNameLength,
		setGroup,
		toggle,
		type PermissionGroup,
		type PermissionRole
	} from '$lib/permissions';

	let {
		role,
		groups,
		onsave,
		onclose
	}: {
		role: PermissionRole;
		groups: PermissionGroup[];
		onsave: (role: PermissionRole) => void;
		onclose: () => void;
	} = $props();

	let draft = $state<PermissionRole>(untrack(() => structuredClone($state.snapshot(role))));
	let filter = $state('');
	let openGroup = $state(untrack(() => groups[0]?.key ?? ''));

	const ready = $derived(draft.name.trim().length > 0);
	const total = $derived(grantedCount(draft));

	const shown = $derived(
		groups
			.map((group) => ({
				...group,
				permissions: filter.trim()
					? group.permissions.filter((entry) =>
							`${entry.label} ${entry.key} ${entry.description}`
								.toLowerCase()
								.includes(filter.trim().toLowerCase())
						)
					: group.permissions
			}))
			.filter((group) => group.permissions.length)
	);
</script>

<Modal
	title="Edit permission role"
	description="Give this role a name, link it to Discord roles, then choose what it can do."
	width="max-w-5xl"
	tall
	{onclose}
>
	<div class="grid gap-x-10 gap-y-6 lg:grid-cols-[20rem_1fr]">
		<section class="flex flex-col gap-5">
			<Field label="Name" description="Shown here and in the panel.">
				<Input bind:value={draft.name} maxlength={maxRoleNameLength} placeholder="Supervisor" />
			</Field>

			<Field label="Discord roles" description="Anyone holding one of these gets everything below.">
				<Roles bind:selected={draft.discord_role_ids} placeholder="No Discord roles" />
			</Field>

			<p class="rounded-lg border border-line bg-white/5 px-3 py-2 text-sm text-muted">
				{total} permission{total === 1 ? '' : 's'} granted.
			</p>
		</section>

		<section class="flex min-w-0 flex-col gap-4 lg:border-l lg:border-line lg:pl-10">
			<div class="ml-auto w-full sm:w-64">
				<Input bind:value={filter} placeholder="Search permissions" />
			</div>

			{#if !shown.length}
				<p class="text-sm text-muted">Nothing matches that search.</p>
			{/if}

			<div class="flex flex-col gap-2">
				{#each shown as group (group.key)}
					{@const granted = groupGranted(draft, group)}
					<div class="overflow-hidden rounded-lg border border-line">
						<div class="flex flex-wrap items-center gap-3 bg-white/2 px-4 py-3">
							<button
								type="button"
								onclick={() => (openGroup = openGroup === group.key ? '' : group.key)}
								aria-expanded={openGroup === group.key}
								class="flex min-w-0 flex-1 items-center gap-2 text-left"
							>
								<span class="font-medium">{group.label}</span>
								<span class="text-xs text-muted">{granted}/{group.permissions.length}</span>
							</button>

							<button
								type="button"
								onclick={() => setGroup(draft, group, granted < group.permissions.length)}
								class="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
							>
								<Check class="h-3.5 w-3.5" />
								{granted < group.permissions.length ? 'Grant all' : 'Revoke all'}
							</button>
						</div>

						{#if openGroup === group.key || filter.trim()}
							<ul class="divide-y divide-line" transition:slide={{ duration: 160 }}>
								{#each group.permissions as entry (entry.key)}
									<li class="flex flex-wrap items-center gap-4 px-4 py-3">
										<div class="min-w-40 flex-1">
											<p class="text-sm font-medium">{entry.label}</p>
											<p class="mt-0.5 text-sm text-muted">{entry.description}</p>
										</div>

										<Switch
											checked={draft.permissions[entry.key] === true}
											label={entry.label}
											onchange={(next: boolean) => toggle(draft, entry.key, next)}
										/>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	</div>

	{#snippet footer()}
		{#if !ready}
			<p class="mr-auto text-sm text-muted">Give the role a name.</p>
		{/if}

		<button
			type="button"
			onclick={onclose}
			class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
		>
			Cancel
		</button>

		<button
			type="button"
			disabled={!ready}
			onclick={() => onsave($state.snapshot(draft) as PermissionRole)}
			class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:py-3"
		>
			Save role
		</button>
	{/snippet}
</Modal>
