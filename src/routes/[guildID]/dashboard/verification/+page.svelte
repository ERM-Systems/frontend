<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Send from '@lucide/svelte/icons/send';
	import { enhance } from '$app/forms';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import MessageEditor from '$lib/components/discord/MessageEditor.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { editable } from '$lib/settingsForm.svelte';
	import { toast } from '$lib/toast.svelte';
	import {
		maxAccountAge,
		nicknameLimit,
		nicknameVariables,
		overlappingRoles,
		sendProblem,
		verificationProblem,
		verificationVariables,
		verifyButtonRoles,
		verifyMessageVariables
	} from '$lib/verification';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	let editing = $state<'message' | 'dm_message' | null>(null);
	let editorOpen = $state(false);
	let sending = $state(false);

	const problem = $derived(verificationProblem(form.value));
	const clashing = $derived(overlappingRoles(form.value));
	const sendHint = $derived(
		form.dirty ? 'Save your changes first, ERM posts the saved message.' : sendProblem(form.value)
	);

	function edit(which: 'message' | 'dm_message') {
		editing = which;
		editorOpen = true;
	}
</script>

<svelte:head><title>Verification - {data.guild.name}</title></svelte:head>

<PageHeader description="Link Discord accounts to Roblox, then hand out roles automatically." />

<div class="mt-8 flex flex-col gap-6">
	<Card title="Verification" description="How members prove which Roblox account is theirs.">
		<div class="divide-y divide-line">
			<Row tight label="Enabled" description="Turn the whole system on or off for this server.">
				<Switch bind:checked={form.value.enabled} label="Verification enabled" />
			</Row>

			<Row
				tight
				label="Verify on join"
				description="Members who already linked their Roblox account to ERM are verified the moment they join, without touching a button."
			>
				<Switch bind:checked={form.value.auto_verify} label="Verify on join" />
			</Row>

			<Row
				tight
				label="Verify command"
				description="Let members run /verify themselves at any time."
			>
				<Switch bind:checked={form.value.command_enabled} label="Verify command" />
			</Row>
		</div>
	</Card>

	<Card title="Roles" description="What changes once someone is verified.">
		<div class="divide-y divide-line">
			<Row label="Verified roles" description="Given to a member once they verify.">
				<Roles bind:selected={form.value.verified_roles} placeholder="No roles" />
			</Row>

			<Row
				label="Unverified roles"
				description="Taken away once they verify. Useful for a holding role that only sees the verify channel."
			>
				<Roles bind:selected={form.value.unverified_roles} placeholder="No roles" />
			</Row>
		</div>

		{#if clashing.length}
			<Callout tone="warning">
				{clashing.length === 1 ? 'A role is' : `${clashing.length} roles are`} in both lists, so verifying
				would add and remove the same thing. Take
				{clashing.length === 1 ? 'it' : 'them'} out of one of them.
			</Callout>
		{/if}
	</Card>

	<Card title="Nickname" description="Rename members to match their Roblox account.">
		<div class="divide-y divide-line">
			<Row
				label="Nickname format"
				description="Leave this empty to leave nicknames alone. ERM cannot rename the server owner or anyone above it in the role list."
			>
				<Input
					bind:value={form.value.nickname}
					placeholder={'{roblox.username}'}
					maxlength={nicknameLimit}
					label="Nickname format"
				/>
			</Row>
		</div>

		<div class="flex flex-wrap gap-2 px-6 pb-5">
			{#each nicknameVariables as entry (entry.token)}
				<button
					type="button"
					onclick={() =>
						(form.value.nickname = `${form.value.nickname}${entry.token}`.slice(0, nicknameLimit))}
					title={entry.description}
					class="rounded-md border border-line bg-white/5 px-2 py-1 font-mono text-xs text-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
				>
					{entry.token}
				</button>
			{/each}
		</div>
	</Card>

	<Card title="Requirements" description="Turn people away before they get a role.">
		<div class="divide-y divide-line">
			<Row
				label="Minimum account age"
				description="How old their Roblox account has to be, in days. Zero lets anyone through."
			>
				<Input
					type="number"
					bind:value={form.value.min_account_age}
					min={0}
					max={maxAccountAge}
					label="Minimum account age in days"
				/>
			</Row>
		</div>
	</Card>

	<Card title="Messages" description="The prompt members see, and what ERM sends them afterwards.">
		<div class="divide-y divide-line">
			<Row
				label="Verify channel"
				description="Where the verify button is posted. Leave empty if you only want verification on join."
			>
				<ChannelSelect
					bind:value={form.value.channel_id}
					placeholder="No channel"
					label="Verify channel"
				/>
			</Row>

			<Row tight label="Verify message" description="The message with the verify button on it.">
				<button
					type="button"
					onclick={() => edit('message')}
					class="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 pointer-coarse:py-3"
				>
					<Pencil class="h-4 w-4" />
					Edit message
				</button>
			</Row>

			<div>
				<Row
					tight
					label="Post the verify message"
					description="Posts the saved message in the verify channel, with its Verify button."
				>
					<form
						method="POST"
						action="?/send"
						use:enhance={() => {
							sending = true;

							return async ({ result }) => {
								sending = false;

								if (result.type === 'failure') {
									toast(
										String(result.data?.message ?? 'Could not post the verify message.'),
										'error'
									);
									return;
								}
								if (result.type !== 'success') {
									toast('Could not post the verify message, try again.', 'error');
									return;
								}

								toast('Verify message posted.', 'success');
							};
						}}
					>
						<button
							type="submit"
							disabled={sending || Boolean(sendHint)}
							aria-describedby={sendHint ? 'verify-send-hint' : undefined}
							class="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
						>
							<Send class="h-4 w-4" />
							{sending ? 'Posting...' : 'Post message'}
						</button>
					</form>
				</Row>

				{#if sendHint}
					<p id="verify-send-hint" class="-mt-2 px-6 pb-4 text-sm text-muted">{sendHint}</p>
				{/if}
			</div>

			<Row
				tight
				label="Message them after"
				description="Send a direct message once someone verifies."
			>
				<Switch bind:checked={form.value.dm_enabled} label="Message them after verifying" />
			</Row>

			{#if form.value.dm_enabled}
				<Row tight label="Direct message" description="What ERM sends them.">
					<button
						type="button"
						onclick={() => edit('dm_message')}
						class="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 pointer-coarse:py-3"
					>
						<Pencil class="h-4 w-4" />
						Edit message
					</button>
				</Row>
			{/if}
		</div>
	</Card>
</div>

{#if editing}
	<MessageEditor
		bind:open={editorOpen}
		message={form.value[editing]}
		title={editing === 'dm_message' ? 'Verified message' : 'Verify message'}
		variables={editing === 'message' ? verifyMessageVariables : verificationVariables}
		buttonRoles={editing === 'message' ? verifyButtonRoles : []}
	/>
{/if}

<SaveBar {form} blocked={Boolean(problem)} blockedLabel={problem} />
