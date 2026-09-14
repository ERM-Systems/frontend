<script lang="ts">
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { editable } from '$lib/settingsForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);
</script>

<PageHeader
	description="Watch your ER:LC server for unusual activity and alert your team when it happens."
/>

<div class="mt-8 flex flex-col gap-6">
	<Card title="Alerts" description="Where alerts land and who hears about them.">
		{#snippet action()}
			<Switch bind:checked={form.value.enabled} label="Game Security" />
		{/snippet}

		<div
			class="transition-opacity {form.value.enabled ? '' : 'pointer-events-none opacity-50'}"
			inert={!form.value.enabled}
		>
			<div class="divide-y divide-line">
				<Row
					label="Webhook Channel"
					description="The channel your ER:LC server posts its kick and ban webhook to. ERM only reads this one."
				>
					<ChannelSelect bind:value={form.value.webhook_channel} />
				</Row>

				<Row label="Alerts Channel" description="Where ERM reports what it caught.">
					<ChannelSelect bind:value={form.value.channel} />
				</Row>

				<Row
					label="Alert Roles"
					description="The roles that will be notified when an alert is triggered."
				>
					<Roles bind:selected={form.value.role} placeholder="No roles" />
				</Row>
			</div>

			<Callout>
				ERM watches for a single kick or ban command that hits five or more players at once, which
				is usually a compromised staff account rather than normal moderation.
			</Callout>

			<Callout tone="warning">
				Both channels are needed. Without the webhook channel there is nothing to read, and ERM
				stays quiet.
			</Callout>
		</div>
	</Card>
</div>

<SaveBar {form} />
