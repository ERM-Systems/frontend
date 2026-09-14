<script lang="ts">
	import Clock4 from '@lucide/svelte/icons/clock-4';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Card from '$lib/components/settings/Card.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Duration from '$lib/components/settings/Duration.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { editable } from '$lib/settingsForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	function addQuota() {
		form.value.role_quotas = [...form.value.role_quotas, { role: '', quota: 0 }];
	}

	function removeQuota(index: number) {
		form.value.role_quotas = form.value.role_quotas.filter((_, position) => position !== index);
	}

	let selectedType = $state<number | null>(null);

	const active = $derived(
		form.value.types.find((type) => type.id === selectedType) ?? form.value.types[0] ?? null
	);

	function addType() {
		const highest = form.value.types.reduce((max, type) => Math.max(max, type.id), 0);
		const created = {
			id: highest + 1,
			name: '',
			channel: '',
			nickname: '',
			role: [],
			access_roles: [],
			break_roles: []
		};

		form.value.types = [...form.value.types, created];
		selectedType = created.id;
	}

	function removeType(index: number) {
		form.value.types = form.value.types.filter((_, position) => position !== index);
		selectedType = form.value.types[Math.min(index, form.value.types.length - 1)]?.id ?? null;
	}

	function quotaRole(index: number): string[] {
		return form.value.role_quotas[index].role ? [form.value.role_quotas[index].role] : [];
	}
</script>

<PageHeader description="How your staff go on duty, and what you expect from them." />

<div class="mt-8 flex flex-col gap-6">
	<Card title="Shifts" description="How your staff go on and off duty.">
		{#snippet action()}
			<Switch bind:checked={form.value.enabled} label="Shifts" />
		{/snippet}

		<div
			class="grid gap-5 px-6 py-5 transition-opacity sm:grid-cols-2 {form.value.enabled
				? ''
				: 'pointer-events-none opacity-50'}"
			inert={!form.value.enabled}
		>
			<Field label="Shift Logs" description="Where shift starts and ends are posted.">
				<ChannelSelect bind:value={form.value.channel} />
			</Field>

			<Field label="On-Duty Role" description="Given to staff while they are on duty.">
				<Roles bind:selected={form.value.role} placeholder="No roles" />
			</Field>

			<Field
				label="Nickname Prefix"
				description="Added in front of a staff member's nickname while on duty."
			>
				<Input bind:value={form.value.nickname_prefix} maxlength={16} placeholder="[ON] " />
			</Field>

			<Field
				label="Maximum Staff"
				description="Stop new shifts once this many are on duty. 0 means no limit."
			>
				<Input type="number" min={0} bind:value={form.value.maximum_staff} suffix="staff" />
			</Field>

			<Field
				label="Server Quota"
				description="Total time on duty expected from everyone without a role quota. It counts every shift ever logged."
			>
				<Duration bind:seconds={form.value.quota} units={['minutes', 'hours']} />
			</Field>
		</div>
	</Card>

	<Card title="Role Quotas" description="Override the server quota for specific roles.">
		{#snippet action()}
			<button
				type="button"
				onclick={addQuota}
				class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Role quota
			</button>
		{/snippet}

		{#if !form.value.role_quotas.length}
			<p class="px-6 py-5 text-sm text-muted">
				No role quotas. Staff without a quota will be expected to meet the server's default quota.
			</p>
		{:else}
			<ul class="divide-y divide-line">
				{#each form.value.role_quotas as quota, index (index)}
					<li class="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
						<div class="min-w-0 flex-1">
							<Roles
								selected={quotaRole(index)}
								placeholder="Pick a role"
								single
								onchange={(next: string[]) => (quota.role = next[0] ?? '')}
							/>
						</div>

						<div class="w-full sm:w-64">
							<Duration bind:seconds={quota.quota} units={['minutes', 'hours']} />
						</div>

						<button
							type="button"
							onclick={() => removeQuota(index)}
							aria-label="Remove role quota"
							class="self-start rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 pointer-coarse:px-3.5 pointer-coarse:py-3.5"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card
		title="Shift Types"
		description="Separate kinds of duty, each with their own roles and log channel."
	>
		{#snippet action()}
			<button
				type="button"
				onclick={addType}
				class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Add
			</button>
		{/snippet}

		{#if !form.value.types.length}
			<div class="px-6 py-10 text-center">
				<div
					class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
				>
					<Clock4 class="h-5 w-5 text-muted" />
				</div>
				<p class="mt-4 font-medium">No shift types yet</p>
				<p class="mx-auto mt-1 max-w-80 text-sm text-muted">
					Staff will use the default shift. Add a type to give a group its own roles and log
					channel.
				</p>
				<button
					type="button"
					onclick={addType}
					class="mt-5 inline-flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
				>
					<Plus class="h-4 w-4" />
					Add shift type
				</button>
			</div>
		{:else}
			<div class="grid lg:grid-cols-[15rem_minmax(0,1fr)]">
				<ul
					class="max-h-100 overflow-y-auto border-b border-line p-2 lg:max-h-none lg:border-r lg:border-b-0"
				>
					{#each form.value.types as type (type.id)}
						<li>
							<button
								type="button"
								onclick={() => (selectedType = type.id)}
								aria-current={active?.id === type.id ? 'true' : undefined}
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors pointer-coarse:py-3 {active?.id ===
								type.id
									? 'bg-white/8 font-medium text-white'
									: 'text-muted hover:bg-white/5 hover:text-white'}"
							>
								<span class="flex-1 truncate {type.name.trim() ? '' : 'italic'}">
									{type.name.trim() || 'Untitled type'}
								</span>
							</button>
						</li>
					{/each}
				</ul>

				{#if active}
					{@const index = form.value.types.indexOf(active)}
					<div class="min-w-0 px-6 py-5">
						<div class="flex items-center gap-3">
							<div class="flex-1">
								<Input bind:value={active.name} maxlength={32} placeholder="Shift type name" />
							</div>

							<button
								type="button"
								onclick={() => removeType(index)}
								aria-label="Delete {active.name.trim() || 'shift type'}"
								class="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 pointer-coarse:py-3"
							>
								<Trash2 class="h-4 w-4" />
								Delete
							</button>
						</div>

						<div class="mt-5 grid gap-5 sm:grid-cols-2">
							<Field label="Log channel" description="Falls back to the main shift log.">
								<ChannelSelect bind:value={active.channel} placeholder="Use the main log" />
							</Field>

							<Field
								label="Nickname prefix"
								description="Used instead of the server prefix."
								counter="{active.nickname.length}/16"
							>
								<Input bind:value={active.nickname} maxlength={16} placeholder="[ON] " />
							</Field>

							<Field label="On-duty roles" description="Given while on this type of shift.">
								<Roles bind:selected={active.role} placeholder="No roles" />
							</Field>

							<Field label="Access roles" description="Who can start this type of shift.">
								<Roles bind:selected={active.access_roles} placeholder="Everyone" />
							</Field>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</Card>
</div>

<SaveBar {form} />
