<script lang="ts">
	import { untrack } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ChannelSelect from './ChannelSelect.svelte';
	import Channels from './Channels.svelte';
	import Duration from './Duration.svelte';
	import Field from './Field.svelte';
	import Input from './Input.svelte';
	import Roles from './Roles.svelte';
	import Select from './Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { maxRuleName, type AntiPingRule } from '$lib/antiPing';

	let {
		rule,
		creating = false,
		onsave,
		onclose
	}: {
		rule: AntiPingRule;
		creating?: boolean;
		onsave: (rule: AntiPingRule) => void;
		onclose: () => void;
	} = $props();

	let draft = $state<AntiPingRule>(untrack(() => structuredClone($state.snapshot(rule))));

	const shiftModes = [
		{ value: 'always', label: 'Always protect', hint: 'Ignore shifts entirely' },
		{ value: 'off_duty', label: 'Only when off duty', hint: 'Reaching on duty staff is fine' },
		{ value: 'on_duty', label: 'Only when on duty', hint: 'Do not disturb staff who are working' }
	];

	const actions = [
		{ value: 'timeout', label: 'Time them out' },
		{ value: 'kick', label: 'Kick them' }
	];

	const shiftHelp: Record<string, string> = {
		always: 'These roles are protected at all times.',
		off_duty: 'Members on an active shift can be pinged, and are protected once they clock off.',
		on_duty: 'Members are protected while on an active shift, and can be pinged once they finish.'
	};

	const ready = $derived(draft.name.trim().length > 0 && draft.role.length > 0);
</script>

<Modal
	title={creating ? 'Add rule' : 'Edit rule'}
	description="Each rule protects its own roles, in its own channels, with its own exceptions."
	width="max-w-6xl"
	tall
	{onclose}
>
	<div class="grid gap-y-6 lg:grid-cols-2">
		<section class="flex flex-col gap-5 lg:pr-10" aria-label="Who is protected">
			<Field label="Name" description="Only used in this dashboard, to help you tell rules apart.">
				<Input
					bind:value={draft.name}
					maxlength={maxRuleName}
					placeholder="Command staff"
					label="Name"
				/>
			</Field>

			<div class="grid gap-5 sm:grid-cols-2">
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class="text-sm font-medium">Rule enabled</p>
						<p class="mt-1 text-sm text-muted">Turns this rule off without deleting it.</p>
					</div>

					<Switch bind:checked={draft.enabled} label="Rule enabled" />
				</div>

				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class="text-sm font-medium">Use hierarchy</p>
						<p class="mt-1 text-sm text-muted">
							Only protects members who outrank the person pinging them.
						</p>
					</div>

					<Switch bind:checked={draft.use_hierarchy} label="Use hierarchy" />
				</div>
			</div>

			<Field
				label="Protected roles"
				description="Anyone with one of these roles is protected by this rule."
			>
				<Roles
					bind:selected={draft.role}
					placeholder="No protected roles"
					label="Protected roles"
				/>
			</Field>

			<Field
				label="Roles that may ping them"
				description="These roles can ping protected members without getting a reply."
			>
				<Roles
					bind:selected={draft.bypass_role}
					placeholder="Nobody is exempt"
					label="Roles that may ping them"
				/>
			</Field>

			<Field
				label="Ignored channels"
				description="This rule does nothing in these channels, threads and categories."
			>
				<Channels
					bind:selected={draft.ignored_channels}
					placeholder="No ignored channels"
					label="Ignored channels"
				/>
			</Field>
		</section>

		<section
			class="flex flex-col gap-5 lg:border-l lg:border-line lg:pl-10"
			aria-label="Shift awareness and escalation"
		>
			<Field label="When to protect" description={shiftHelp[draft.shift.mode]}>
				<Select options={shiftModes} bind:value={draft.shift.mode} label="When to protect" />
			</Field>

			{#if draft.shift.mode !== 'always'}
				<div class="grid gap-5 sm:grid-cols-2">
					<Field
						label="Grace period"
						description="How long a member still counts as on duty after their shift ends."
					>
						<Duration
							bind:seconds={draft.shift.grace}
							units={['minutes', 'hours']}
							label="Grace period"
						/>
					</Field>

					<Field
						label="Breaks count as off duty"
						description="Treats a member on a break as off duty for this rule."
					>
						<div class="flex h-10 items-center">
							<Switch bind:checked={draft.shift.break_off_duty} label="Breaks count as off duty" />
						</div>
					</Field>
				</div>
			{/if}

			<Field
				label="Log channel"
				description="Every warning this rule sends is posted here, with what happened."
			>
				<ChannelSelect bind:value={draft.log_channel} placeholder="No log channel" />
			</Field>

			<div class="flex flex-col gap-2">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<p class="text-sm font-medium">Escalation</p>
					<Switch bind:checked={draft.escalation.enabled} label="Escalation" />
				</div>

				{#if draft.escalation.enabled}
					<div class="mt-3 grid gap-5 sm:grid-cols-2">
						<Field
							label="Pings that escalate"
							description="The action below happens on this many pings inside the window."
						>
							<Input
								type="number"
								min={2}
								max={20}
								bind:value={draft.escalation.threshold}
								label="Pings that escalate"
							/>
						</Field>

						<Field
							label="Time window"
							description="Pings older than this stop counting towards the limit."
						>
							<Duration
								bind:seconds={draft.escalation.window}
								units={['minutes', 'hours']}
								label="Time window"
							/>
						</Field>

						<Field
							label="Action at the limit"
							description="What the bot does once a member reaches the limit."
						>
							<Select
								options={actions}
								bind:value={draft.escalation.action}
								label="Action at the limit"
							/>
						</Field>

						{#if draft.escalation.action === 'timeout'}
							<Field label="Timeout length" description="How long the member is timed out for.">
								<Duration
									bind:seconds={draft.escalation.duration}
									units={['minutes', 'hours']}
									label="Timeout length"
								/>
							</Field>
						{/if}
					</div>
				{:else}
					<p class="text-sm text-muted">
						Every ping gets a reply telling the member to stop. Nothing further happens.
					</p>
				{/if}
			</div>
		</section>
	</div>

	{#snippet footer()}
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
			onclick={() => onsave($state.snapshot(draft) as AntiPingRule)}
			class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:py-3"
		>
			Save rule
		</button>
	{/snippet}
</Modal>
