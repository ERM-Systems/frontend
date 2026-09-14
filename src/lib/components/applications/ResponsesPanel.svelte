<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import Search from '@lucide/svelte/icons/search';
	import Send from '@lucide/svelte/icons/send';
	import ResponseCard from './ResponseCard.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Card from '$lib/components/settings/Card.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import {
		answerText,
		answerable,
		formMaximum,
		type ApplicationForm,
		type ApplicationResponse,
		type LivePlayer
	} from '$lib/applications';
	import { toast } from '$lib/toast.svelte';

	let {
		application,
		responses,
		players = []
	}: {
		application: ApplicationForm;
		responses: ApplicationResponse[];
		players?: LivePlayer[];
	} = $props();

	const shell =
		'min-h-10 w-full rounded-lg border border-line bg-white/5 pointer-coarse:min-h-11 py-2 pr-3 pl-10 text-sm placeholder:text-muted focus:border-white/25 focus:ring-0';

	const statuses = [
		{ value: 'all', label: 'Every response' },
		{ value: 'unreviewed', label: 'Pending' },
		{ value: 'approved', label: 'Approved' },
		{ value: 'denied', label: 'Denied' },
		{ value: 'staged', label: 'Staged' }
	];

	const sorts = [
		{ value: 'newest', label: 'Newest first' },
		{ value: 'oldest', label: 'Oldest first' },
		{ value: 'score', label: 'Highest score' }
	];

	let status = $state('all');
	let sort = $state('newest');
	let query = $state('');
	let open = $state('');
	let publishing = $state(false);

	const pending = $derived(responses.filter((entry) => entry.reviewStatus === 'unreviewed').length);
	const denied = $derived(responses.filter((entry) => entry.reviewStatus === 'denied').length);
	const approved = $derived(responses.length - pending - denied);
	const staged = $derived(responses.filter((entry) => entry.staged).length);

	const scored = $derived(responses.filter((entry) => entry.score));
	const average = $derived(
		scored.length
			? Math.round(
					scored.reduce((total, entry) => total + (entry.score?.total ?? 0), 0) / scored.length
				)
			: 0
	);

	const stats = $derived([
		{ label: 'Total', value: String(responses.length) },
		{ label: 'Pending', value: String(pending) },
		{ label: 'Approved', value: String(approved) },
		{ label: 'Denied', value: String(denied) },
		{ label: 'Staged', value: String(staged) },
		...(application.scoring.enabled
			? [{ label: 'Average score', value: `${average}/${formMaximum(application)}` }]
			: [])
	]);

	const visible = $derived.by(() => {
		const term = query.trim().toLowerCase();

		const filtered = responses.filter((entry) => {
			if (status === 'staged' && !entry.staged) return false;
			if (status !== 'all' && status !== 'staged' && entry.reviewStatus !== status) return false;
			if (!term) return true;

			return (
				entry.username.toLowerCase().includes(term) || entry.discordID.toLowerCase().includes(term)
			);
		});

		return filtered.toSorted((first, second) => {
			if (sort === 'score') return (second.score?.total ?? 0) - (first.score?.total ?? 0);

			const left = Date.parse(first.submittedAt) || 0;
			const right = Date.parse(second.submittedAt) || 0;

			return sort === 'oldest' ? left - right : right - left;
		});
	});

	function liveFor(response: ApplicationResponse): LivePlayer | null {
		const robloxId = response.roblox ? String(response.roblox.robloxID) : '';
		if (!robloxId) return null;

		return players.find((player) => player.id === robloxId) ?? null;
	}

	function cell(value: string): string {
		return `"${value.replace(/"/g, '""')}"`;
	}

	function exportCsv() {
		const questions = application.questions.filter((entry) => answerable(entry.type));
		const header = [
			'Username',
			'Discord ID',
			'Submitted',
			'Status',
			'Score',
			...questions.map((question) => question.title || 'Untitled question')
		];

		const rows = visible.map((entry) => [
			entry.username,
			entry.discordID,
			entry.submittedAt,
			entry.reviewStatus,
			entry.score ? `${entry.score.total}/${entry.score.max}` : '',
			...questions.map((question) => answerText(question, entry.answers[question.id]))
		]);

		const csv = [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		link.download = `${application.title || 'application'}-responses.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
	}
</script>

<div class="flex flex-col gap-6">
	<Card title="Responses" description="Everything applicants have sent to this form.">
		{#snippet action()}
			<div class="flex flex-wrap gap-2">
				{#if responses.length}
					<button
						type="button"
						onclick={exportCsv}
						disabled={!visible.length}
						class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
					>
						<Download class="h-4 w-4" />
						Export CSV
					</button>
				{/if}

				{#if staged}
					<form
						method="POST"
						action="?/publish"
						use:enhance={() => {
							publishing = true;

							return async ({ result }) => {
								publishing = false;

								if (result.type === 'failure') {
									toast(
										String(result.data?.message ?? 'Could not publish those results.'),
										'error'
									);
									return;
								}

								toast('Staged results published.', 'success');
								await invalidateAll();
							};
						}}
					>
						<button
							type="submit"
							disabled={publishing}
							class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
						>
							<Send class="h-4 w-4" />
							{publishing ? 'Publishing...' : `Publish ${staged} staged`}
						</button>
					</form>
				{/if}
			</div>
		{/snippet}

		<div class="flex flex-wrap gap-3 border-b border-line px-6 py-5">
			{#each stats as stat (stat.label)}
				<div class="min-w-32 flex-1 rounded-lg border border-line bg-white/2 px-4 py-3">
					<p class="text-xs text-muted">{stat.label}</p>
					<p class="mt-1 text-xl font-semibold">{stat.value}</p>
				</div>
			{/each}
		</div>

		<div class="flex flex-col gap-3 px-6 py-5 sm:flex-row">
			<div class="relative min-w-0 flex-1">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
				/>
				<input
					bind:value={query}
					placeholder="Search by username or Discord ID"
					aria-label="Search responses"
					class={shell}
				/>
			</div>

			<div class="w-full shrink-0 sm:w-44">
				<Select options={statuses} bind:value={status} placeholder="Every response" />
			</div>

			<div class="w-full shrink-0 sm:w-44">
				<Select options={sorts} bind:value={sort} placeholder="Newest first" />
			</div>
		</div>
	</Card>

	{#each visible as response (response.responseID)}
		<ResponseCard
			{response}
			{application}
			live={liveFor(response)}
			expanded={open === response.responseID}
			ontoggle={() => (open = open === response.responseID ? '' : response.responseID)}
			onchanged={() => invalidateAll()}
		/>
	{:else}
		<p class="rounded-xl border border-line bg-surface px-6 py-10 text-center text-sm text-muted">
			{responses.length ? 'Nothing matches those filters.' : 'No responses yet.'}
		</p>
	{/each}
</div>
