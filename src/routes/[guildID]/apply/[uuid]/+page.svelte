<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Loader from '@lucide/svelte/icons/loader-circle';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Send from '@lucide/svelte/icons/send';
	import X from '@lucide/svelte/icons/x';
	import { fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		answerText,
		answerable,
		checkAnswer,
		formPages,
		isBlank,
		pageTitle,
		type Question
	} from '$lib/applications';
	import FormPreview from '$lib/components/applications/FormPreview.svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import Meta from '$lib/components/Meta.svelte';
	import { tint } from '$lib/serverOverview';
	import { toast } from '$lib/toast.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let answers = $state<Record<string, unknown>>({});
	let showAll = $state(false);
	let sending = $state(false);
	let done = $state(false);
	let reapply = $state(false);
	let step = $state(0);

	const card = 'overflow-hidden rounded-2xl border border-line bg-surface';

	const accent = $derived(data.form.themeColor);
	const questions = $derived(data.form.questions);
	const asked = $derived(questions.filter((question) => answerable(question.type)));
	const required = $derived(asked.filter((question) => question.required));

	const answered = $derived(required.filter((question) => !isBlank(answers[question.id])).length);
	const progress = $derived(required.length ? Math.round((answered / required.length) * 100) : 100);

	const problems = $derived.by(() => {
		const found: Record<string, string> = {};

		for (const question of asked) {
			const problem = checkAnswer(question, answers[question.id]);
			if (problem) found[question.id] = problem;
		}

		return found;
	});

	const serverErrors = $derived((form as { errors?: Record<string, string> } | null)?.errors ?? {});

	const sent = $derived(done || form?.submitted === true);

	const shown = $derived.by(() => {
		const found: Record<string, string> = {};

		for (const question of asked) {
			const problem =
				showAll || answers[question.id] !== undefined
					? problems[question.id]
					: serverErrors[question.id];
			if (problem) found[question.id] = problem;
		}

		return found;
	});

	const submitted = $derived(
		data.review
			? new Date(data.review.submittedAt).toLocaleDateString('en-GB', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: ''
	);

	const marks = $derived(data.review?.score?.marks ?? {});

	const showForm = $derived(!sent && !data.gate && (!data.review || reapply));
	const heading = $derived({ ...data.form, questions: [] });
	const stripe = $derived(`border-top-width: 10px; border-top-color: ${accent}`);
	const centered = $derived(sent || (!data.review && !!data.gate));
	const blocked = $derived(Object.keys(problems).length > 0);
	const description = $derived(data.form.description || `Apply through ${data.form.title}.`);

	const pages = $derived(formPages(questions));
	const lastPage = $derived(step >= pages.length - 1);

	const blockerGroups = $derived(
		pages
			.map((entries, index) => ({
				page: index,
				title: pageTitle(entries),
				items: entries
					.filter((question) => problems[question.id])
					.map((question) => ({
						id: question.id,
						title: question.title || 'Untitled question',
						message: problems[question.id]
					}))
			}))
			.filter((group) => group.items.length)
	);

	const blockerCount = $derived(
		blockerGroups.reduce((total, group) => total + group.items.length, 0)
	);

	function advance(entries: Question[]): boolean {
		showAll = true;

		if (entries.some((question) => problems[question.id])) {
			toast('Some answers on this page still need fixing.', 'error');
			return false;
		}

		showAll = false;
		return true;
	}
</script>

<Meta
	title={data.form.title || 'Application'}
	{description}
	image={data.form.bannerUrl ?? ''}
	wide={!!data.form.bannerUrl}
/>

<svelte:head><meta name="theme-color" content={accent} /></svelte:head>

<div class="relative">
	<div
		class="pointer-events-none absolute inset-x-0 -top-14 h-78"
		style="background: linear-gradient(to bottom, {tint(accent, 0.09)}, transparent)"
	></div>

	<div
		class="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-3xl flex-col gap-4 px-6 py-10 {centered
			? 'justify-center'
			: ''}"
	>
		{#if !showForm}
			<FormPreview form={heading} disabled />
		{/if}

		{#if sent}
			<section class={card} style={stripe} in:fly={{ y: 12, duration: 320 }}>
				<div class="px-6 py-10 text-center sm:px-8">
					<span
						class="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
						style="background: {tint(accent, 0.15)}; color: {accent}"
					>
						<Check class="h-7 w-7" />
					</span>

					<h2 class="mt-5 text-xl font-bold tracking-[-0.02em]">Application sent</h2>

					<div class="mt-3 **:text-center">
						<Markdown
							source={data.form.submittedMessage ||
								'Thanks for applying, you will hear back once it has been reviewed.'}
						/>
					</div>

					<a
						href={resolve('/guilds')}
						class="mt-7 inline-flex rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
					>
						Back to your servers
					</a>
				</div>
			</section>
		{:else}
			{#if data.review}
				{@const approved = data.review.status === 'approved'}
				<section class={card} style={stripe} in:fly={{ y: 12, duration: 320 }}>
					<div class="flex flex-wrap items-center gap-4 border-b border-line px-6 py-6 sm:px-8">
						<span
							class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold {approved
								? 'border-green-400/30 bg-green-400/10 text-green-300'
								: 'border-red-400/30 bg-red-400/10 text-red-300'}"
						>
							{#if approved}
								<Check class="h-4 w-4" />
								Approved
							{:else}
								<X class="h-4 w-4" />
								Denied
							{/if}
						</span>

						<p class="text-sm text-muted">Submitted {submitted}</p>

						{#if data.review.score}
							<span
								class="ml-auto rounded-lg border border-line bg-white/5 px-3 py-1.5 text-sm font-medium pointer-coarse:py-3"
							>
								{data.review.score.total} / {data.review.score.max}
								<span class="ml-1 text-muted">
									{data.review.score.passed ? 'passed' : 'did not pass'}
								</span>
							</span>
						{/if}
					</div>

					{#if data.review.reason}
						<div class="border-b border-line px-6 py-6 sm:px-8">
							<p class="text-xs tracking-wide text-muted uppercase">Reviewer notes</p>
							<div class="mt-2"><Markdown source={data.review.reason} /></div>
						</div>
					{/if}

					<div class="flex flex-col gap-6 px-6 py-7 sm:px-8">
						{#each questions as question (question.id)}
							{#if answerable(question.type)}
								{@const mark = marks[question.id]}
								<div>
									<div class="flex flex-wrap items-baseline justify-between gap-2">
										<p class="text-sm font-semibold">{question.title || 'Untitled question'}</p>

										{#if mark}
											<span
												class="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold {mark.earned >=
												mark.worth
													? 'border-green-400/30 bg-green-400/10 text-green-300'
													: mark.earned <= 0
														? 'border-red-400/30 bg-red-400/10 text-red-300'
														: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300'}"
											>
												{mark.earned} / {mark.worth}
											</span>
										{/if}
									</div>

									<p class="mt-1.5 text-sm whitespace-pre-wrap text-muted">
										{answerText(question, data.review.answers[question.id])}
									</p>
								</div>
							{:else if question.type === 'section'}
								<h2 class="border-t border-line pt-6 text-lg font-bold tracking-[-0.02em]">
									{question.title || 'Untitled section'}
								</h2>
							{/if}
						{/each}
					</div>
				</section>

				{#if data.gate}
					<div
						class="{card} flex items-start gap-3 px-6 py-5 text-sm text-muted sm:px-7"
						in:fly={{ y: 12, duration: 320 }}
					>
						<CircleAlert class="mt-0.5 h-4 w-4 shrink-0" />

						<div class="min-w-0 flex-1 sm:max-w-prose">
							<p class="font-medium text-white">{data.gate.title}</p>

							{#if data.gate.markdown}
								<div class="mt-1"><Markdown source={data.gate.message} compact /></div>
							{:else}
								<p class="mt-1">{data.gate.message}</p>
							{/if}
						</div>
					</div>
				{:else if !reapply}
					<div
						class="{card} flex flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-7"
						in:fly={{ y: 12, duration: 320 }}
					>
						<p class="text-sm text-muted">You are eligible to send another application.</p>

						<button
							type="button"
							onclick={() => (reapply = true)}
							class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] pointer-coarse:py-3"
							style="background: linear-gradient(135deg, {tint(accent, 0.95)}, {tint(
								accent,
								0.65
							)})"
						>
							<RotateCcw class="h-4 w-4" />
							Apply again
						</button>
					</div>
				{/if}
			{:else if data.gate}
				<section class={card} style={stripe} in:fly={{ y: 12, duration: 320 }}>
					<div class="px-6 py-10 text-center sm:px-8">
						<span
							class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-muted"
						>
							<CircleAlert class="h-7 w-7" />
						</span>

						<h2 class="mt-5 text-xl font-bold tracking-[-0.02em]">{data.gate.title}</h2>

						{#if data.gate.markdown}
							<div class="mt-3 **:text-center"><Markdown source={data.gate.message} /></div>
						{:else}
							<p class="mt-3 text-sm text-muted">{data.gate.message}</p>
						{/if}
					</div>
				</section>
			{/if}

			{#if showForm}
				<div
					class="sticky top-16 z-20 rounded-xl border border-line bg-surface/85 px-5 py-3.5 backdrop-blur"
				>
					<div class="flex items-center justify-between text-xs text-muted">
						<span>{answered} of {required.length} required answered</span>
						<span>{progress}%</span>
					</div>

					<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
						<div
							class="h-full rounded-full transition-[width] duration-300"
							style="width: {progress}%; background: {accent}"
						></div>
					</div>
				</div>

				<form
					method="POST"
					class="flex flex-col gap-4"
					use:enhance={({ cancel }) => {
						showAll = true;

						if (blocked) {
							toast('Some answers still need fixing.', 'error');
							cancel();
							return;
						}

						sending = true;

						return async ({ result, update }) => {
							sending = false;

							if (result.type === 'failure') {
								toast(String(result.data?.message ?? 'Could not send your application.'), 'error');
								await update({ reset: false });
								return;
							}

							done = true;
							window.scrollTo({ top: 0, behavior: 'smooth' });
						};
					}}
				>
					<input type="hidden" name="answers" value={JSON.stringify(answers)} />

					<FormPreview
						form={data.form}
						bind:answers
						bind:page={step}
						onadvance={advance}
						errors={shown}
						disabled={sending}
					/>

					{#if showAll && blockerCount}
						<div class={card}>
							<div class="border-b border-line px-6 py-5 sm:px-7">
								<p class="text-sm font-semibold">Before you can submit</p>
								<p class="mt-1 text-xs text-muted">
									{blockerCount} question{blockerCount === 1 ? '' : 's'} still {blockerCount === 1
										? 'needs'
										: 'need'} attention.
								</p>
							</div>

							<div class="flex flex-col gap-5 px-6 py-5 sm:px-7">
								{#each blockerGroups as group (group.page)}
									<div>
										<p class="text-xs tracking-wide text-muted uppercase">{group.title}</p>

										<ul class="mt-2 flex flex-col gap-2">
											{#each group.items as item (item.id)}
												<li>
													<button
														type="button"
														onclick={() => (step = group.page)}
														class="flex w-full items-start gap-3 rounded-lg border border-line bg-white/5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/10"
													>
														<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-red-400" />

														<span class="min-w-0 flex-1">
															<span class="block font-medium">{item.title}</span>
															<span class="mt-0.5 block text-xs text-muted">{item.message}</span>
														</span>
													</button>
												</li>
											{/each}
										</ul>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if lastPage}
						<div class="{card} flex flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-7">
							<p class="text-xs text-muted">
								Your Discord account is sent along with your answers.
							</p>

							<button
								type="submit"
								disabled={sending || !asked.length}
								class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
								style="background: linear-gradient(135deg, {tint(accent, 0.95)}, {tint(
									accent,
									0.65
								)})"
							>
								{#if sending}
									<Loader class="h-4 w-4 animate-spin" />
									Sending
								{:else}
									<Send class="h-4 w-4" />
									Submit application
								{/if}
							</button>
						</div>
					{/if}
				</form>
			{/if}
		{/if}
	</div>
</div>
