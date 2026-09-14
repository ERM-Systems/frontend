<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Loader from '@lucide/svelte/icons/loader-circle';
	import Send from '@lucide/svelte/icons/send';
	import { fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Meta from '$lib/components/Meta.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import { toast } from '$lib/toast.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let choice = $state('');
	let note = $state('');
	let minutes = $state('10');
	let sending = $state(false);

	const card = 'overflow-hidden rounded-2xl border border-line bg-surface';

	const options = $derived(data.types.map((entry) => ({ value: entry.name, label: entry.name })));
	const type = $derived(choice || (data.types[0]?.name ?? ''));
	const chosen = $derived(data.types.find((entry) => entry.name === type));
	const reason = $derived(chosen?.reason || note);
	const sent = $derived(form?.submitted === true);
	const failed = $derived(form?.field ?? '');
</script>

<Meta
	title="Request a priority in {data.guild.name}"
	description="Ask the staff team of {data.guild.name} for a priority."
	image={data.guild.iconUrl}
	noindex
/>

<div class="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-2xl flex-col gap-4 px-6 py-10">
	{#if sent}
		<section class={card} in:fly={{ y: 12, duration: 320 }}>
			<div class="px-6 py-10 text-center sm:px-8">
				<span
					class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-muted"
				>
					<Check class="h-7 w-7" />
				</span>

				<h2 class="mt-5 text-xl font-bold tracking-[-0.02em]">Request sent</h2>
				<p class="mt-3 text-sm text-muted">
					The staff team of {data.guild.name} will review it and let you know in Discord.
				</p>

				<a
					href={resolve('/[guildID]/server', { guildID: data.guild.id })}
					class="mt-7 inline-flex rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
				>
					Back to the server
				</a>
			</div>
		</section>
	{:else}
		<section class={card} in:fly={{ y: 12, duration: 320 }}>
			<div class="flex items-center gap-4 border-b border-line px-6 py-6 sm:px-8">
				{#if data.guild.iconUrl}
					<img
						src={data.guild.iconUrl}
						alt=""
						class="h-12 w-12 shrink-0 rounded-xl border border-line object-cover"
					/>
				{/if}

				<div class="min-w-0">
					<h1 class="truncate text-xl font-bold tracking-[-0.02em]">Request a priority</h1>
					<p class="mt-1 truncate text-sm text-muted">{data.guild.name}</p>
				</div>
			</div>

			<form
				method="POST"
				use:enhance={() => {
					sending = true;

					return async ({ result, update }) => {
						sending = false;

						if (result.type === 'failure') {
							toast(String(result.data?.message ?? 'Could not send your request.'), 'error');
							await update({ reset: false });
							return;
						}

						await update({ reset: false });
					};
				}}
				class="flex flex-col gap-6 px-6 py-7 sm:px-8"
			>
				<Field label="Request type" description="What you are asking the staff team for.">
					<Select
						{options}
						value={type}
						onchange={(next) => (choice = next)}
						label="Request type"
						describedBy={failed === 'type' ? 'request-type-error' : undefined}
					/>
					<input type="hidden" name="type" value={type} />
					{#if failed === 'type'}
						<p id="request-type-error" class="mt-2 text-sm text-red-400">{form?.message}</p>
					{/if}
				</Field>

				<Field label="Reason" description="Why you need this priority.">
					<textarea
						value={reason}
						oninput={(event) => (note = event.currentTarget.value)}
						name="reason"
						rows="4"
						maxlength="500"
						readonly={!!chosen?.reason}
						aria-label="Reason"
						aria-invalid={failed === 'reason'}
						aria-describedby={failed === 'reason' ? 'request-reason-error' : undefined}
						placeholder="Tell the staff team what you have planned."
						class="w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted read-only:text-muted focus:border-line focus:ring-0"
					></textarea>
					{#if failed === 'reason'}
						<p id="request-reason-error" class="mt-2 text-sm text-red-400">{form?.message}</p>
					{/if}
				</Field>

				<Field label="Length in minutes" description="How long the priority should run for.">
					<Input
						bind:value={minutes}
						type="number"
						min={1}
						max={1440}
						label="Length in minutes"
						invalid={failed === 'time'}
						describedBy={failed === 'time' ? 'request-time-error' : undefined}
					/>
					<input type="hidden" name="time" value={minutes} />
					{#if failed === 'time'}
						<p id="request-time-error" class="mt-2 text-sm text-red-400">{form?.message}</p>
					{/if}
				</Field>

				<button
					type="submit"
					disabled={sending || !type || reason.trim().length < 2}
					class="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:opacity-50 pointer-coarse:py-3"
				>
					{#if sending}
						<Loader class="h-4 w-4 animate-spin" />
					{:else}
						<Send class="h-4 w-4" />
					{/if}
					Send request
				</button>
			</form>
		</section>
	{/if}
</div>
