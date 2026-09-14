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

<PageHeader description="Partial time off, where a reduced quota is still expected." />

<div class="mt-8 flex flex-col gap-6">
	<Card title="Reduced Activity" description="How reduced activity requests are handled.">
		{#snippet action()}
			<Switch bind:checked={form.value.enabled} label="Reduced Activity Requests" />
		{/snippet}

		<div
			class="divide-y divide-line transition-opacity {form.value.enabled
				? ''
				: 'pointer-events-none opacity-50'}"
			inert={!form.value.enabled}
		>
			<Row
				label="Request Channel"
				description="Where reduced activity requests are posted. Separate from the leave channel, and while it is empty requests cannot be filed."
			>
				<ChannelSelect bind:value={form.value.channel} placeholder="No channel" />
			</Row>

			<Row
				label="Reduced Activity Role"
				description="Applied while a staff member is on reduced activity."
			>
				<Roles bind:selected={form.value.ra_role} placeholder="No role" single />
			</Row>
		</div>

		<Callout tone="warning">
			Leaving the channel above empty means requests have nowhere to go and are refused, even when
			the toggle is on.
		</Callout>
	</Card>
</div>

<SaveBar {form} />
