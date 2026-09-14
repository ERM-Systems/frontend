<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { formPages, pageTitle, type ApplicationForm, type Question } from '$lib/applications';
	import QuestionInput from '$lib/components/applications/QuestionInput.svelte';
	import Markdown from '$lib/components/Markdown.svelte';

	let {
		form,
		answers = $bindable({}),
		errors = {},
		disabled = false,
		page = $bindable(0),
		onadvance
	}: {
		form: ApplicationForm;
		answers?: Record<string, unknown>;
		errors?: Record<string, string>;
		disabled?: boolean;
		page?: number;
		onadvance?: (questions: Question[]) => boolean;
	} = $props();

	const card = 'overflow-hidden rounded-2xl border border-line bg-surface';
	const accent = $derived(form.themeColor);
	const stripe = $derived(`border-top-width: 10px; border-top-color: ${accent}`);

	const pages = $derived(formPages(form.questions));
	const current = $derived(pages[Math.min(page, pages.length - 1)] ?? []);

	function step(direction: number) {
		if (direction > 0 && onadvance && !onadvance(current)) return;

		page = Math.min(Math.max(page + direction, 0), pages.length - 1);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<div class="flex flex-col gap-4">
	{#if form.bannerUrl}
		<div class={card} style={stripe}>
			<img src={form.bannerUrl} alt="" class="aspect-3/1 w-full object-cover" />
		</div>
	{/if}

	<header class={card} style={stripe}>
		<div class="px-6 py-7 sm:px-8">
			<h1 class="text-3xl leading-tight font-bold tracking-[-0.03em]">
				{form.title || 'Untitled application'}
			</h1>

			{#if form.description}
				<div class="mt-3"><Markdown source={form.description} /></div>
			{/if}
		</div>
	</header>

	{#each current as question (question.id)}
		<div class="{card} px-6 py-6 sm:px-7">
			<QuestionInput
				{question}
				{accent}
				{disabled}
				bind:value={answers[question.id]}
				error={errors[question.id] ?? ''}
			/>
		</div>
	{/each}

	{#if pages.length > 1}
		<div class="{card} flex flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-7">
			<div class="min-w-0">
				<p class="text-sm font-semibold">{pageTitle(current)}</p>
				<p class="mt-0.5 text-xs text-muted">Page {page + 1} of {pages.length}</p>
			</div>

			<div class="flex shrink-0 items-center gap-2">
				<button
					type="button"
					disabled={disabled || page === 0}
					onclick={() => step(-1)}
					class="inline-flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:py-3"
				>
					<ChevronLeft class="h-4 w-4" />
					Previous
				</button>

				<button
					type="button"
					disabled={disabled || page >= pages.length - 1}
					onclick={() => step(1)}
					class="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:py-3"
					style="background: {accent}"
				>
					Next
					<ChevronRight class="h-4 w-4" />
				</button>
			</div>
		</div>
	{/if}
</div>
