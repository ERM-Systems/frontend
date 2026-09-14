<script lang="ts">
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import PermissionRoleModal from '$lib/components/settings/PermissionRoleModal.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import { editable } from '$lib/settingsForm.svelte';
	import {
		blankPermissionRole,
		maxPermissionRoles,
		roleSummary,
		type PermissionRole
	} from '$lib/permissions';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => ({
		roles: data.roles,
		levels: data.levels
	}));

	let editing = $state<PermissionRole | null>(null);
	let removing = $state<PermissionRole | null>(null);

	const full = $derived(form.value.roles.length >= maxPermissionRoles);

	function add() {
		editing = blankPermissionRole(`Role ${form.value.roles.length + 1}`);
	}

	function save(role: PermissionRole) {
		const index = form.value.roles.findIndex((entry) => entry.id && entry.id === role.id);

		if (index === -1) form.value.roles = [...form.value.roles, role];
		else form.value.roles = form.value.roles.map((entry, at) => (at === index ? role : entry));

		editing = null;
	}

	function remove(role: PermissionRole) {
		form.value.roles = form.value.roles.filter((entry) => entry !== role);
		removing = null;
	}
</script>

<svelte:head><title>Permissions - {data.guild.name}</title></svelte:head>

<PageHeader description="Custom roles that decide who can use what." />

<div class="mt-8 flex flex-col gap-6">
	<Card title="Roles">
		<div class="divide-y divide-line">
			<Row
				label="Staff Role"
				description="Manage their own shifts and create punishments. Safe to hand out widely."
			>
				<Roles bind:selected={form.value.levels.staffRoles} placeholder="No staff roles" />
			</Row>

			<Row
				label="Admin Role"
				description="Moderate other staff, manage everyone's shifts, and approve leave and reduced activity requests. They can also wipe shift data."
			>
				<Roles bind:selected={form.value.levels.adminRoles} placeholder="No admin roles" />
			</Row>

			<Row
				label="Management Role"
				description="Change anything ERM does here, including these settings."
			>
				<Roles
					bind:selected={form.value.levels.managementRoles}
					placeholder="No management roles"
				/>
			</Row>
		</div>

		<Callout tone="warning">
			Management is the highest level and can change everything here, including these settings.
			Anyone you give it to can lock you out. The server owner always counts as management, and
			Discord's Administrator permission counts as admin, whatever you set here.
		</Callout>
	</Card>

	<Card title="Custom Roles" description="Configure custom permission levels">
		{#snippet action()}
			<button
				type="button"
				onclick={add}
				disabled={full}
				title={full ? `You can have up to ${maxPermissionRoles} roles` : 'Add a role'}
				class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Add role
			</button>
		{/snippet}

		{#if !form.value.roles.length}
			<div class="px-6 py-10 text-center">
				<div
					class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
				>
					<KeyRound class="h-5 w-5 text-muted" />
				</div>
				<p class="mt-4 font-medium">No custom roles yet</p>
				<p class="mx-auto mt-1 max-w-96 text-sm text-muted">
					Staff, Admin and Management already cover the basics. Add a role to give specific Discord
					roles access to individual commands and dashboard pages on top of that.
				</p>
				<button
					type="button"
					onclick={add}
					class="mt-5 inline-flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
				>
					<Plus class="h-4 w-4" />
					Add role
				</button>
			</div>
		{:else}
			<ul class="divide-y divide-line">
				{#each form.value.roles as role (role)}
					<li class="flex flex-wrap items-center gap-4 px-6 py-4">
						<div class="min-w-40 flex-1">
							<p class="font-medium">{role.name}</p>
							<p class="mt-1 text-sm text-muted">
								{roleSummary(role, data.groups)}
								{#if role.discord_role_ids.length}
									· {role.discord_role_ids.length} Discord role{role.discord_role_ids.length === 1
										? ''
										: 's'}
								{:else}
									· not linked to a Discord role yet
								{/if}
							</p>
						</div>

						<div class="flex shrink-0 gap-2">
							<button
								type="button"
								onclick={() => (editing = role)}
								class="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
							>
								<Pencil class="h-4 w-4" />
								Edit
							</button>

							<button
								type="button"
								onclick={() => (removing = role)}
								aria-label="Delete {role.name}"
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

{#if editing}
	<PermissionRoleModal
		role={editing}
		groups={data.groups}
		onsave={save}
		onclose={() => (editing = null)}
	/>
{/if}

{#if removing}
	<Modal
		title="Delete {removing.name}"
		description="Anyone who only had this role loses those permissions."
		width="max-w-md"
		onclose={() => (removing = null)}
	>
		<p class="text-sm text-muted">Nothing changes in Discord. The Discord roles themselves stay.</p>

		{#snippet footer()}
			<button
				type="button"
				onclick={() => (removing = null)}
				class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Cancel
			</button>

			<button
				type="button"
				onclick={() => removing && remove(removing)}
				class="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				Delete role
			</button>
		{/snippet}
	</Modal>
{/if}

<SaveBar {form} />
