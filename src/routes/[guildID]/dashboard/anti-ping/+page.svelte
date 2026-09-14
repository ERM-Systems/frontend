<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import ShieldOff from '@lucide/svelte/icons/shield-off';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import AntiPingRuleModal from '$lib/components/settings/AntiPingRuleModal.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { editable } from '$lib/settingsForm.svelte';
	import { emptyAntiPingRule, maxRules, ruleSummary, type AntiPingRule } from '$lib/antiPing';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	let editing = $state<AntiPingRule | null>(null);
	let removing = $state<AntiPingRule | null>(null);

	const full = $derived(form.value.rules.length >= maxRules);
	const creating = $derived(
		!!editing && !form.value.rules.some((entry) => entry.id === editing?.id)
	);

	function add() {
		editing = emptyAntiPingRule(`Rule ${form.value.rules.length + 1}`);
	}

	function save(rule: AntiPingRule) {
		const index = form.value.rules.findIndex((entry) => entry.id === rule.id);

		if (index === -1) form.value.rules = [...form.value.rules, rule];
		else form.value.rules = form.value.rules.map((entry, at) => (at === index ? rule : entry));

		editing = null;
	}

	function remove(rule: AntiPingRule) {
		form.value.rules = form.value.rules.filter((entry) => entry.id !== rule.id);
		removing = null;
	}
</script>

<svelte:head><title>Anti-Ping - {data.guild.name}</title></svelte:head>

<PageHeader description="Warn users who ping protected roles." />

<div class="mt-8 flex flex-col gap-6">
	<Card
		title="Anti-Ping"
		description="Each rule protects its own roles, in its own channels, with its own exceptions."
	>
		{#snippet action()}
			<div class="flex items-center gap-3">
				<button
					type="button"
					onclick={add}
					disabled={!form.value.enabled || full}
					title={full ? `You can have up to ${maxRules} rules` : 'Add a rule'}
					class="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:py-3"
				>
					<Plus class="h-4 w-4" />
					Add rule
				</button>

				<Switch bind:checked={form.value.enabled} label="Anti-Ping" />
			</div>
		{/snippet}

		<div
			class="transition-opacity {form.value.enabled ? '' : 'pointer-events-none opacity-50'}"
			inert={!form.value.enabled}
		>
			{#if !form.value.rules.length}
				<div class="px-6 py-10 text-center">
					<div
						class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
					>
						<ShieldOff class="h-5 w-5 text-muted" />
					</div>
					<p class="mt-4 font-medium">No rules yet</p>
					<p class="mx-auto mt-1 max-w-96 text-sm text-muted">
						A rule decides which roles are protected, who is allowed to ping them, and where the
						warning applies. Add one to get started.
					</p>
					<button
						type="button"
						onclick={add}
						class="mt-5 inline-flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
					>
						<Plus class="h-4 w-4" />
						Add rule
					</button>
				</div>
			{:else}
				<ul class="divide-y divide-line">
					{#each form.value.rules as rule (rule.id)}
						<li class="flex flex-wrap items-center gap-4 px-6 py-4">
							<div class="min-w-40 flex-1">
								<p class="flex items-center gap-2 font-medium">
									{rule.name}
									{#if !rule.enabled}
										<span
											class="rounded-md border border-line bg-white/5 px-1.5 py-0.5 text-xs text-muted"
										>
											Off
										</span>
									{/if}
								</p>
								<p class="mt-1 text-sm text-muted">
									{rule.role.length ? ruleSummary(rule) : 'No protected roles yet'}
								</p>
							</div>

							<div class="flex shrink-0 gap-2">
								<button
									type="button"
									onclick={() => (editing = rule)}
									class="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
								>
									<Pencil class="h-4 w-4" />
									Edit
								</button>

								<button
									type="button"
									onclick={() => (removing = rule)}
									aria-label="Delete {rule.name}"
									class="rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 pointer-coarse:px-3.5 pointer-coarse:py-3.5"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</Card>
</div>

{#if editing}
	<AntiPingRuleModal rule={editing} {creating} onsave={save} onclose={() => (editing = null)} />
{/if}

{#if removing}
	<Modal
		title="Delete {removing.name}"
		description="The roles in this rule stop being protected."
		width="max-w-md"
		onclose={() => (removing = null)}
	>
		<p class="text-sm text-muted">
			Nothing changes in Discord. Your other rules keep working as they are.
		</p>

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
				Delete rule
			</button>
		{/snippet}
	</Modal>
{/if}

<SaveBar {form} />
