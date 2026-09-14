<script lang="ts">
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Duration from '$lib/components/settings/Duration.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { permissionLevels } from '$lib/settings';
	import { dashboardHref } from '$lib/dashboard';
	import { editable } from '$lib/settingsForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	const link = (slug: string) => dashboardHref(data.guild.id, slug);

	const levels = permissionLevels.map((level) => ({
		value: String(level.value),
		label: level.label
	}));

	const feeds = [
		{
			key: 'message' as const,
			label: 'Message Logging',
			description: 'Announcements your staff log from in game.'
		},
		{
			key: 'sts' as const,
			label: 'STS Logging',
			description: 'Shoulder-to-shoulder sessions, logged with everyone who took part.'
		},
		{
			key: 'priority' as const,
			label: 'Priority Logging',
			description: 'Priorities your staff log by hand.'
		}
	];
</script>

<PageHeader description="Mirror what happens in your ER:LC server into Discord." />

<div class="mt-8 grid items-start gap-6 lg:grid-cols-2">
	<div class="flex flex-col gap-6">
		{#each feeds as feed (feed.key)}
			<Card title={feed.label} description={feed.description}>
				{#snippet action()}
					<Switch bind:checked={form.value[feed.key].enabled} label={feed.label} />
				{/snippet}

				<div
					class="grid gap-5 px-6 py-5 transition-opacity {form.value[feed.key].enabled
						? ''
						: 'pointer-events-none opacity-50'}"
					inert={!form.value[feed.key].enabled}
				>
					<Field label="Channel" description="Where these logs are posted.">
						<ChannelSelect bind:value={form.value[feed.key].channel} />
					</Field>
				</div>

				{#if feed.key === 'priority'}
					<Callout>
						This allows staff to log priorities by themselves. For an automated system, check the
						<a href={link('priorities')} class="underline underline-offset-2 hover:text-white">
							Priorities
						</a> settings.
					</Callout>
				{/if}
			</Card>
		{/each}
	</div>

	<div class="flex flex-col gap-6">
		<Card
			title="Staff Requests"
			description="Let staff ask for backup in game and have it posted here."
		>
			{#snippet action()}
				<Switch bind:checked={form.value.staff_requests.enabled} label="Staff requests" />
			{/snippet}

			<div
				class="grid gap-5 px-6 py-5 transition-opacity {form.value.staff_requests.enabled
					? ''
					: 'pointer-events-none opacity-50'}"
				inert={!form.value.staff_requests.enabled}
			>
				<Field label="Channel" description="Where requests are posted.">
					<ChannelSelect bind:value={form.value.staff_requests.channel} />
				</Field>

				<Field label="Mentioned Roles" description="Pinged whenever a request comes in.">
					<Roles bind:selected={form.value.staff_requests.mentioned_roles} placeholder="No roles" />
				</Field>

				<Field label="Minimum Permissions" description="Who is allowed to send a request.">
					<Select
						options={levels}
						value={String(form.value.staff_requests.permission_level)}
						onchange={(next: string) => (form.value.staff_requests.permission_level = Number(next))}
					/>
				</Field>

				<Field label="Cooldown" description="How long a member waits between requests.">
					<Duration
						bind:seconds={form.value.staff_requests.cooldown}
						units={['seconds', 'minutes']}
					/>
				</Field>

				<Field
					label="Minimum Staff"
					description="Requests are blocked unless more staff than this are on duty. Zero turns the check off."
				>
					<Input
						type="number"
						min={0}
						bind:value={form.value.staff_requests.min_staff}
						suffix="staff"
					/>
				</Field>

				<Field
					label="Maximum Staff"
					description="Requests are blocked once more staff than this are on duty. Zero turns the check off."
				>
					<Input
						type="number"
						min={0}
						bind:value={form.value.staff_requests.max_staff}
						suffix="staff"
					/>
				</Field>
			</div>

			<Callout>
				Requests are sent with /staff request in Discord, and the staff counts come from ERM shifts
				that are currently open, not from your ER:LC server.
			</Callout>
		</Card>
	</div>
</div>

<SaveBar {form} />
