<script lang="ts">
	import Star from '@lucide/svelte/icons/star';
	import Markdown from '$lib/components/Markdown.svelte';
	import { imagePoint, ratingMax, type Question } from '$lib/applications';
	import { tint } from '$lib/serverOverview';

	let {
		question,
		value = $bindable(),
		error = '',
		accent = '#f03232',
		disabled = false
	}: {
		question: Question;
		value: unknown;
		error?: string;
		accent?: string;
		disabled?: boolean;
	} = $props();

	const shell =
		'min-h-10 w-full rounded-lg border border-line bg-white/5 pointer-coarse:min-h-11 px-3 py-2 text-sm pointer-coarse:min-h-11 placeholder:text-muted focus:border-white/25 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

	const errorId = $derived(`${question.id}-error`);
	const describedBy = $derived(error ? errorId : undefined);

	const text = $derived(value === undefined || value === null ? '' : String(value));
	const picked = $derived(Array.isArray(value) ? value.map(String) : text ? [text] : []);
	const rating = $derived(Number(value) || 0);

	const bounds = $derived.by(() => {
		const rule = question.validationRules.find((entry) => entry.type === 'range');
		return { min: rule?.params.minValue ?? 0, max: rule?.params.maxValue ?? 10 };
	});

	const slider = $derived(
		Number.isFinite(Number(value)) && text !== '' ? Number(value) : bounds.min
	);

	const point = $derived(imagePoint(value));

	function pick(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
		const rect = event.currentTarget.getBoundingClientRect();

		value = {
			coordinates: {
				x: ((event.clientX - rect.left) / rect.width) * 100,
				y: ((event.clientY - rect.top) / rect.height) * 100
			}
		};
	}

	function toggle(option: string, on: boolean) {
		const next = picked.filter((entry) => entry !== option);
		if (on) next.push(option);
		value = next;
	}

	const kinds: Record<string, string> = {
		number: 'number',
		calendar: 'date',
		time: 'time',
		email: 'email',
		phone: 'tel',
		url: 'url'
	};

	function optionStyle(active: boolean): string {
		return active ? `border-color: ${accent}; background: ${tint(accent, 0.12)}` : '';
	}
</script>

{#if question.type === 'section'}
	<div>
		<h2 class="text-xl font-bold tracking-[-0.02em]">{question.title || 'Untitled section'}</h2>
		{#if question.description}
			<div class="mt-2"><Markdown source={question.description} /></div>
		{/if}
	</div>
{:else}
	<div class="flex flex-col gap-3">
		<div>
			<p class="text-base font-semibold">
				{question.title || 'Untitled question'}
				{#if question.required}
					<span style="color: {accent}">*</span>
					<span class="sr-only">(required)</span>
				{/if}
			</p>
			{#if question.description}
				<div class="mt-1.5"><Markdown source={question.description} compact /></div>
			{/if}
		</div>

		{#if question.type === 'image_selection'}
			{#if question.imageUrl}
				<div class="relative overflow-hidden rounded-lg border border-line">
					<img src={question.imageUrl} alt="" class="block w-full select-none" />

					<button
						type="button"
						{disabled}
						onclick={pick}
						aria-describedby={describedBy}
						aria-label="Click the image to pick a spot"
						class="absolute inset-0 cursor-crosshair disabled:cursor-not-allowed"
					>
						{#if point}
							<span
								class="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
								style="left: {point.x}%; top: {point.y}%; border-color: {accent}; background: {tint(
									accent,
									0.35
								)}"
							></span>
						{/if}
					</button>
				</div>

				{#if !point}
					<p class="text-sm text-muted">Click the image to pick a spot.</p>
				{/if}
			{:else}
				<p class="rounded-lg border border-line bg-white/5 px-3 py-2 text-sm text-muted">
					This question has no image set yet.
				</p>
			{/if}
		{:else if question.type === 'long'}
			<textarea
				{disabled}
				rows="5"
				value={text}
				oninput={(event) => (value = event.currentTarget.value)}
				aria-invalid={!!error}
				aria-describedby={describedBy}
				placeholder="Your answer"
				class={shell}></textarea>
		{:else if question.type === 'multiple'}
			<div class="flex flex-col gap-2" role="radiogroup" aria-label={question.title}>
				{#each question.options as option (option)}
					{@const active = picked.includes(option)}
					<label
						class="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-white/5 px-3 py-2.5 text-sm transition-colors hover:bg-white/8 has-disabled:cursor-not-allowed has-disabled:opacity-60"
						style={optionStyle(active)}
					>
						<input
							type="radio"
							{disabled}
							name={question.id}
							checked={active}
							value={option}
							onchange={() => (value = option)}
							aria-describedby={describedBy}
							class="h-4 w-4 shrink-0 border-line bg-white/10 focus:ring-0"
							style="accent-color: {accent}"
						/>
						<span class="min-w-0 flex-1">{option}</span>
					</label>
				{/each}
			</div>
		{:else if question.type === 'checkbox'}
			<div class="flex flex-col gap-2">
				{#each question.options as option (option)}
					{@const active = picked.includes(option)}
					<label
						class="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-white/5 px-3 py-2.5 text-sm transition-colors hover:bg-white/8 has-disabled:cursor-not-allowed has-disabled:opacity-60"
						style={optionStyle(active)}
					>
						<input
							type="checkbox"
							{disabled}
							checked={active}
							onchange={(event) => toggle(option, event.currentTarget.checked)}
							aria-describedby={describedBy}
							class="h-4 w-4 shrink-0 rounded border-line bg-white/10 focus:ring-0"
							style="accent-color: {accent}"
						/>
						<span class="min-w-0 flex-1">{option}</span>
					</label>
				{/each}
			</div>
		{:else if question.type === 'dropdown'}
			<select
				{disabled}
				value={text}
				onchange={(event) => (value = event.currentTarget.value)}
				aria-invalid={!!error}
				aria-describedby={describedBy}
				class={shell}
			>
				<option value="">Select an option</option>
				{#each question.options as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		{:else if question.type === 'rating'}
			<div class="flex items-center gap-1.5">
				{#each { length: ratingMax }, index (index)}
					{@const score = index + 1}
					<button
						type="button"
						{disabled}
						onclick={() => (value = value === score ? '' : score)}
						aria-pressed={rating >= score}
						aria-label="{score} out of {ratingMax}"
						aria-describedby={describedBy}
						class="rounded-lg p-1 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<Star
							class="h-7 w-7"
							style={rating >= score
								? `fill: ${accent}; color: ${accent}`
								: 'fill: none; color: var(--color-muted)'}
						/>
					</button>
				{/each}
				{#if rating}
					<span class="ml-2 text-sm text-muted">{rating} / {ratingMax}</span>
				{/if}
			</div>
		{:else if question.type === 'range'}
			<div class="flex items-center gap-4">
				<span class="w-8 shrink-0 text-xs text-muted">{bounds.min}</span>
				<input
					type="range"
					{disabled}
					min={bounds.min}
					max={bounds.max}
					value={slider}
					oninput={(event) => (value = Number(event.currentTarget.value))}
					aria-describedby={describedBy}
					class="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
					style="accent-color: {accent}"
				/>
				<span class="w-8 shrink-0 text-right text-xs text-muted">{bounds.max}</span>
				<span
					class="w-12 shrink-0 rounded-lg border border-line bg-white/5 py-1 text-center text-sm"
					style={text === '' ? '' : `border-color: ${accent}`}
				>
					{text === '' ? '-' : slider}
				</span>
			</div>
		{:else}
			<input
				{disabled}
				type={kinds[question.type] ?? 'text'}
				value={text}
				oninput={(event) => (value = event.currentTarget.value)}
				aria-invalid={!!error}
				aria-describedby={describedBy}
				placeholder={question.type === 'url' ? 'https://example.com' : 'Your answer'}
				autocomplete="off"
				class={shell}
			/>
		{/if}

		{#if error}
			<p id={errorId} class="text-sm text-red-400">{error}</p>
		{/if}
	</div>
{/if}
