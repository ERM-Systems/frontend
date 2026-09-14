<script lang="ts">
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import CopyPlus from '@lucide/svelte/icons/copy-plus';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Link from '@lucide/svelte/icons/link';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Markdown from '$lib/components/Markdown.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import { descriptionLimit, titleLimit, type ApplicationForm } from '$lib/applications';
	import { tint } from '$lib/serverOverview';
	import { relativeTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let counts = $state<Awaited<PageData['counts']>>({});

	$effect(() => {
		const incoming = data.counts;
		let active = true;

		incoming.then((value) => active && (counts = value));

		return () => {
			active = false;
		};
	});

	let query = $state('');
	let status = $state('');
	let creating = $state(false);
	let removing = $state<ApplicationForm | null>(null);
	let busy = $state(false);
	let title = $state('');
	let description = $state('');

	const statuses = [
		{ value: '', label: 'All applications' },
		{ value: 'open', label: 'Accepting responses' },
		{ value: 'closed', label: 'Closed' }
	];

	const filtered = $derived.by(() => {
		const term = query.trim().toLowerCase();

		return data.applications.filter((form) => {
			if (status && form.acceptingResponses !== (status === 'open')) return false;
			return !term || form.title.toLowerCase().includes(term);
		});
	});

	const builder = (form: ApplicationForm) =>
		resolve('/[guildID]/dashboard/applications/[uuid]', { guildID: data.guild.id, uuid: form.id });

	const publicPath = (form: ApplicationForm) =>
		resolve('/[guildID]/apply/[uuid]', { guildID: data.guild.id, uuid: form.id });

	async function copyLink(form: ApplicationForm) {
		try {
			await navigator.clipboard.writeText(`${page.url.origin}${publicPath(form)}`);
			toast('Public link copied.', 'success');
		} catch {
			toast('Your browser would not let us copy that link.', 'error');
		}
	}

	function startCreating() {
		title = '';
		description = '';
		creating = true;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key !== 'Escape' || busy) return;
		creating = false;
		removing = null;
	}}
/>

<div class="flex flex-col gap-8">
	<PageHeader
		description="Build the forms people apply through, then share the link and review what comes in."
	/>

	<div class="flex flex-col gap-3 sm:flex-row">
		<div
			class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-white/5 px-3"
		>
			<Search class="h-4 w-4 shrink-0 text-muted" />
			<input
				bind:value={query}
				placeholder="Search applications"
				aria-label="Search applications"
				class="w-full border-0 bg-transparent px-0 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:py-3"
			/>
		</div>

		<div class="shrink-0 sm:w-56">
			<Select options={statuses} bind:value={status} placeholder="All applications" />
		</div>

		<button
			type="button"
			onclick={startCreating}
			class="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
		>
			<Plus class="h-4 w-4" />
			New application
		</button>
	</div>

	{#if !data.applications.length}
		<div class="rounded-xl border border-line bg-surface p-10 text-center">
			<span
				class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-white/5"
			>
				<ClipboardList class="h-5 w-5 text-muted" />
			</span>

			<h2 class="mt-4 text-xl font-semibold">No applications yet</h2>
			<p class="mx-auto mt-2 max-w-md text-muted">
				An application is a form your members fill in, for staff openings, ban appeals or anything
				else you want to ask about. Build one here, share its link, and every response lands in your
				dashboard for review.
			</p>

			<button
				type="button"
				onclick={startCreating}
				class="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				New application
			</button>
		</div>
	{:else if !filtered.length}
		<p class="rounded-xl border border-line bg-surface px-6 py-10 text-center text-sm text-muted">
			No applications match that search.
		</p>
	{:else}
		<div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
			{#each filtered as form (form.id)}
				{@const count = counts[form.id]}
				<article
					class="flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-white/20"
				>
					<div class="h-1" style="background: {tint(form.themeColor, 0.9)}"></div>

					<div class="flex flex-1 flex-col p-5">
						<div class="flex items-start gap-3">
							<h2 class="min-w-0 flex-1 truncate font-semibold">{form.title || 'Untitled'}</h2>

							{#if form.acceptingResponses}
								<span
									class="shrink-0 rounded-full border border-green-500/40 bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-400"
								>
									Accepting
								</span>
							{:else}
								<span
									class="shrink-0 rounded-full border border-line bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-muted"
								>
									Closed
								</span>
							{/if}
						</div>

						{#if form.description}
							<div class="relative mt-2 max-h-16 overflow-hidden">
								<Markdown source={form.description} compact />
								<div
									class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-surface to-transparent"
								></div>
							</div>
						{:else}
							<p class="mt-2 text-sm text-muted">No description yet.</p>
						{/if}

						<div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
							{#if count}
								<span class={count.pending ? 'font-semibold text-yellow-400' : ''}>
									{count.pending} pending
								</span>
							{:else}
								<span class="skeleton h-3 w-20 rounded bg-white/10"></span>
							{/if}

							{#if count?.latest}
								<span>Last response {relativeTime(count.latest)}</span>
							{/if}
						</div>

						<div class="mt-5 flex flex-wrap items-stretch gap-2">
							<a
								href={builder(form)}
								class="min-w-24 flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 text-center text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
							>
								Open builder
							</a>

							<div class="flex shrink-0 items-stretch gap-2">
								<button
									type="button"
									onclick={() => copyLink(form)}
									aria-label="Copy the public link"
									title="Copy the public link"
									class="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white/5 text-muted transition-colors hover:bg-white/10 hover:text-white pointer-coarse:h-11 pointer-coarse:w-11"
								>
									<Link class="h-4 w-4" />
								</button>

								<a
									href={publicPath(form)}
									target="_blank"
									rel="noreferrer noopener"
									aria-label="Open the public link"
									title="Open the public link"
									class="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white/5 text-muted transition-colors hover:bg-white/10 hover:text-white pointer-coarse:h-11 pointer-coarse:w-11"
								>
									<ExternalLink class="h-4 w-4" />
								</a>

								<form
									class="flex"
									method="POST"
									action="?/duplicate"
									use:enhance={() => {
										busy = true;

										return async ({ result, update }) => {
											busy = false;

											if (result.type === 'failure') {
												toast(
													String(result.data?.message ?? 'Could not copy that application.'),
													'error'
												);
												return;
											}

											await update();
										};
									}}
								>
									<input type="hidden" name="id" value={form.id} />
									<button
										type="submit"
										disabled={busy}
										aria-label="Duplicate this application"
										title="Duplicate this application"
										class="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white/5 text-muted transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:h-11 pointer-coarse:w-11"
									>
										<CopyPlus class="h-4 w-4" />
									</button>
								</form>

								<button
									type="button"
									onclick={() => (removing = form)}
									aria-label="Delete this application"
									title="Delete this application"
									class="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white/5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 pointer-coarse:h-11 pointer-coarse:w-11"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>

{#if creating}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={() => !busy && (creating = false)}
		onkeydown={(event) => event.key === 'Enter' && !busy && (creating = false)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface"
		role="dialog"
		aria-modal="true"
		aria-label="New application"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				busy = true;

				return async ({ result, update }) => {
					busy = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not create that application.'), 'error');
						return;
					}

					creating = false;
					await update();
				};
			}}
		>
			<div class="px-6 pt-6">
				<h2 class="text-lg font-semibold">New application</h2>
				<p class="mt-2 text-sm text-muted">
					Name it and say what it is for. You can add the questions on the next screen.
				</p>
			</div>

			<div class="mt-5 flex flex-col gap-4 px-6">
				<Field label="Title" counter="{title.length}/{titleLimit}">
					<Input bind:value={title} placeholder="Moderator application" maxlength={titleLimit} />
				</Field>

				<Field label="Description" counter="{description.length}/{descriptionLimit}">
					<Input
						bind:value={description}
						placeholder="Tell applicants what you are looking for."
						rows={4}
						maxlength={descriptionLimit}
					/>
				</Field>
			</div>

			<input type="hidden" name="title" value={title} />
			<input type="hidden" name="description" value={description} />

			<div class="mt-6 flex gap-2 border-t border-line bg-white/2 px-6 py-4">
				<button
					type="button"
					onclick={() => (creating = false)}
					disabled={busy}
					class="flex-1 rounded-lg border border-line px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					Cancel
				</button>

				<button
					type="submit"
					disabled={busy || !title.trim()}
					class="flex-1 rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{busy ? 'Creating...' : 'Create'}
				</button>
			</div>
		</form>
	</div>
{/if}

{#if removing}
	{@const target = removing}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={() => !busy && (removing = null)}
		onkeydown={(event) => event.key === 'Enter' && !busy && (removing = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface"
		role="dialog"
		aria-modal="true"
		aria-label="Delete this application"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<div class="flex flex-col items-center px-6 pt-8 text-center">
			<span
				class="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10"
			>
				<TriangleAlert class="h-5 w-5 text-red-400" />
			</span>

			<h2 class="mt-4 text-lg font-semibold">Delete this application</h2>
			<p class="mt-2 text-sm text-muted">
				{target.title || 'This application'} and every response sent to it go away for good. Nobody can
				get them back.
			</p>
		</div>

		<div class="mt-6 flex gap-2 border-t border-line bg-white/2 px-6 py-4">
			<button
				type="button"
				onclick={() => (removing = null)}
				disabled={busy}
				class="flex-1 rounded-lg border border-line px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				Keep it
			</button>

			<form
				method="POST"
				action="?/remove"
				class="flex-1"
				use:enhance={() => {
					busy = true;

					return async ({ result, update }) => {
						busy = false;

						if (result.type === 'failure') {
							toast(String(result.data?.message ?? 'Could not delete that application.'), 'error');
							return;
						}

						removing = null;
						toast('Application deleted.', 'success');
						await update();
					};
				}}
			>
				<input type="hidden" name="id" value={target.id} />
				<button
					type="submit"
					disabled={busy}
					class="w-full rounded-lg bg-red-500 px-3 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{busy ? 'Deleting...' : 'Delete'}
				</button>
			</form>
		</div>
	</div>
{/if}
