<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Copy from '@lucide/svelte/icons/copy';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { slide } from 'svelte/transition';
	import ValidationEditor from './ValidationEditor.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import {
		answerable,
		hasOptions,
		optionLimit,
		optionsPerQuestion,
		questionDescriptionLimit,
		questionKind,
		questionKinds,
		questionMaximum,
		questionTitleLimit,
		validationsFor,
		type Question,
		type QuestionType
	} from '$lib/applications';

	let {
		question = $bindable(),
		position,
		total,
		scoring,
		expanded,
		ontoggle,
		onmove,
		onduplicate,
		ondelete
	}: {
		question: Question;
		position: number;
		total: number;
		scoring: boolean;
		expanded: boolean;
		ontoggle: () => void;
		onmove: (direction: number) => void;
		onduplicate: () => void;
		ondelete: () => void;
	} = $props();

	const kind = $derived(questionKind(question.type));
	const Icon = $derived(kind.icon);
	const maximum = $derived(questionMaximum(question));
	const typeOptions = questionKinds.map((entry) => ({
		value: entry.value,
		label: entry.label,
		group: entry.group,
		icon: entry.icon
	}));
	const shell =
		'min-h-10 w-full rounded-lg border border-line bg-white/5 pointer-coarse:min-h-11 px-3 py-2 text-sm pointer-coarse:min-h-11 placeholder:text-muted focus:border-white/25 focus:ring-0';

	function retype(next: QuestionType) {
		question.type = next;

		if (!answerable(next)) {
			question.required = false;
		}

		if (hasOptions(next)) {
			if (!question.options.length) {
				question.options = ['Option 1'];
			}
		} else {
			question.options = [];
		}

		if (next !== 'image_selection') {
			question.imageUrl = undefined;
			question.selectionArea = undefined;
		}

		question.correct = [];

		question.validationRules = [];
	}

	function placeArea(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
		const rect = event.currentTarget.getBoundingClientRect();
		const width = question.selectionArea?.width || 10;
		const height = question.selectionArea?.height || 10;

		question.selectionArea = {
			x: ((event.clientX - rect.left) / rect.width) * 100 - width / 2,
			y: ((event.clientY - rect.top) / rect.height) * 100 - height / 2,
			width,
			height
		};
	}

	function resizeArea(key: 'width' | 'height', next: number) {
		const size = Math.min(100, Math.max(1, Math.round(next)));
		question.selectionArea = { x: 0, y: 0, width: 10, height: 10, ...question.selectionArea };
		question.selectionArea[key] = size;
	}

	function addOption() {
		if (question.options.length >= optionsPerQuestion) return;

		question.options.push(`Option ${question.options.length + 1}`);
	}

	function renameOption(index: number, next: string) {
		const previous = question.options[index];
		question.options[index] = next;

		const marked = question.correct.indexOf(previous);
		if (marked !== -1) question.correct[marked] = next;
	}

	function toggleCorrect(index: number) {
		const label = question.options[index];
		const marked = question.correct.indexOf(label);

		if (marked !== -1) {
			question.correct.splice(marked, 1);
			return;
		}

		question.correct = question.type === 'checkbox' ? [...question.correct, label] : [label];
	}

	function moveOption(index: number, direction: number) {
		const target = index + direction;
		if (target < 0 || target >= question.options.length) return;

		[question.options[index], question.options[target]] = [
			question.options[target],
			question.options[index]
		];
	}

	function removeOption(index: number) {
		const [dropped] = question.options.splice(index, 1);

		const marked = question.correct.indexOf(dropped);
		if (marked !== -1) question.correct.splice(marked, 1);
	}
</script>

<div class="rounded-xl border border-line bg-surface {expanded ? 'ring-1 ring-white/10' : ''}">
	<div class="flex flex-wrap items-center gap-3 px-4 py-3">
		<GripVertical class="h-4 w-4 shrink-0 cursor-grab text-muted" />

		<button
			type="button"
			onclick={ontoggle}
			aria-expanded={expanded}
			class="flex min-w-0 flex-1 items-center gap-3 text-left pointer-coarse:min-h-11"
		>
			<span
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5"
			>
				<Icon class="h-4 w-4" />
			</span>

			<span class="min-w-0 flex-1">
				<span class="block truncate text-sm font-medium">
					{question.title.trim() || `Untitled ${kind.label.toLowerCase()}`}
				</span>
				<span class="block truncate text-xs text-muted">
					{kind.label}{question.required ? ' - required' : ''}
				</span>
			</span>
		</button>

		{#if scoring && maximum}
			<span class="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-muted">
				{maximum} pts
			</span>
		{/if}

		{#if expanded && answerable(question.type)}
			<div class="flex shrink-0 items-center gap-2 sm:border-r sm:border-line sm:pr-3">
				<span class="text-xs font-medium text-muted">Required</span>
				<Switch bind:checked={question.required} label="Required" />
			</div>
		{/if}

		<div class="ml-auto flex shrink-0 items-center gap-1">
			<button
				type="button"
				onclick={() => onmove(-1)}
				disabled={position === 0}
				aria-label="Move question up"
				class="rounded-lg p-2 text-muted transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:p-3.5"
			>
				<ChevronUp class="h-4 w-4" />
			</button>
			<button
				type="button"
				onclick={() => onmove(1)}
				disabled={position === total - 1}
				aria-label="Move question down"
				class="rounded-lg p-2 text-muted transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:p-3.5"
			>
				<ChevronDown class="h-4 w-4" />
			</button>
			<button
				type="button"
				onclick={onduplicate}
				aria-label="Duplicate question"
				class="rounded-lg p-2 text-muted transition-colors hover:bg-white/10 hover:text-white pointer-coarse:p-3.5"
			>
				<Copy class="h-4 w-4" />
			</button>
			<button
				type="button"
				onclick={ondelete}
				aria-label="Delete question"
				class="rounded-lg p-2 text-muted transition-colors hover:bg-white/10 hover:text-red-400 pointer-coarse:p-3.5"
			>
				<Trash2 class="h-4 w-4" />
			</button>
		</div>
	</div>

	{#if expanded}
		<div
			class="flex flex-col gap-5 border-t border-line px-4 py-5"
			transition:slide={{ duration: 160 }}
		>
			<div class="grid gap-5 sm:grid-cols-2">
				<Field
					label="Question"
					description="What applicants see above their answer."
					counter="{question.title.length}/{questionTitleLimit}"
				>
					<Input
						bind:value={question.title}
						maxlength={questionTitleLimit}
						placeholder="Why do you want to join our staff team?"
					/>
				</Field>

				<Field label="Type" description="How this question is answered.">
					<Select
						options={typeOptions}
						value={question.type}
						onchange={(next) => retype(next as QuestionType)}
						label="Question type"
					/>
				</Field>
			</div>

			<Field
				label="Description"
				description="Markdown works here, so **bold**, *italic*, lists and links all render."
				counter="{question.description.length}/{questionDescriptionLimit}"
				wide
			>
				<div class="flex flex-col gap-2">
					<textarea
						bind:value={question.description}
						maxlength={questionDescriptionLimit}
						rows={3}
						placeholder="Extra context, examples or rules for this answer."
						aria-label="Question description"
						class={shell}></textarea>
				</div>
			</Field>

			{#if hasOptions(question.type)}
				<div class="flex flex-col gap-2">
					<p class="text-sm font-medium">Options</p>

					{#each question.options.keys() as index (index)}
						<div class="flex items-center gap-2">
							<div class="min-w-0 flex-1">
								<Input
									bind:value={() => question.options[index], (next) => renameOption(index, next)}
									maxlength={optionLimit}
									placeholder="Option"
								/>
							</div>

							{#if scoring}
								<button
									type="button"
									onclick={() => toggleCorrect(index)}
									aria-pressed={question.correct.includes(question.options[index])}
									aria-label="Mark this as a correct answer"
									title="Correct answer"
									class="shrink-0 rounded-lg border p-2 transition-colors {question.correct.includes(
										question.options[index]
									)
										? 'border-green-500/40 bg-green-500/15 text-green-400'
										: 'border-line bg-white/5 text-muted hover:bg-white/10 hover:text-white'}"
								>
									<Check class="h-4 w-4" />
								</button>
							{/if}

							<button
								type="button"
								onclick={() => moveOption(index, -1)}
								disabled={index === 0}
								aria-label="Move option up"
								class="shrink-0 rounded-lg border border-line bg-white/5 p-2 text-muted transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
							>
								<ChevronUp class="h-4 w-4" />
							</button>
							<button
								type="button"
								onclick={() => moveOption(index, 1)}
								disabled={index === question.options.length - 1}
								aria-label="Move option down"
								class="shrink-0 rounded-lg border border-line bg-white/5 p-2 text-muted transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
							>
								<ChevronDown class="h-4 w-4" />
							</button>
							<button
								type="button"
								onclick={() => removeOption(index)}
								disabled={question.options.length <= 1}
								aria-label="Remove option"
								class="shrink-0 rounded-lg border border-line bg-white/5 p-2 text-muted transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					{/each}

					<button
						type="button"
						onclick={addOption}
						disabled={question.options.length >= optionsPerQuestion}
						class="flex w-fit items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
					>
						<Plus class="h-4 w-4" />
						Add option
					</button>
				</div>
			{/if}

			{#if question.type === 'image_selection'}
				<Field label="Image" description="A direct link to the image applicants click on." wide>
					<Input
						bind:value={() => question.imageUrl ?? '', (next) => (question.imageUrl = String(next))}
						placeholder="https://example.com/image.png"
					/>
				</Field>

				{#if question.imageUrl}
					<div class="flex flex-col gap-2">
						<p class="text-sm font-medium">Correct area</p>

						<div class="relative overflow-hidden rounded-lg border border-line">
							<img src={question.imageUrl} alt="" class="block w-full select-none" />

							<button
								type="button"
								onclick={placeArea}
								aria-label="Click the image to mark the correct area"
								class="absolute inset-0 cursor-crosshair"
							>
								{#if question.selectionArea}
									<span
										class="absolute border-2 border-green-400 bg-green-400/20"
										style="left: {question.selectionArea.x}%; top: {question.selectionArea
											.y}%; width: {question.selectionArea.width}%; height: {question.selectionArea
											.height}%"
									></span>
								{/if}
							</button>
						</div>

						{#if !question.selectionArea}
							<p class="text-sm text-yellow-400">
								Click the image to mark the correct area, otherwise every answer counts as wrong.
							</p>
						{/if}
					</div>

					<div class="grid gap-5 sm:grid-cols-2">
						<Field label="Area width" description="How wide the correct area is.">
							<Input
								type="number"
								min={1}
								max={100}
								suffix="%"
								bind:value={
									() => question.selectionArea?.width ?? 10,
									(next) => resizeArea('width', Number(next))
								}
							/>
						</Field>

						<Field label="Area height" description="How tall the correct area is.">
							<Input
								type="number"
								min={1}
								max={100}
								suffix="%"
								bind:value={
									() => question.selectionArea?.height ?? 10,
									(next) => resizeArea('height', Number(next))
								}
							/>
						</Field>
					</div>
				{/if}
			{/if}

			{#if answerable(question.type)}
				{#if scoring}
					<div class="grid gap-5 sm:grid-cols-2">
						<Field
							label="Points"
							description={hasOptions(question.type)
								? 'Awarded when the correct answer is picked.'
								: 'Awarded when the answer passes every rule.'}
						>
							<Input type="number" min={0} bind:value={question.points} suffix="pts" />
						</Field>
					</div>

					{#if hasOptions(question.type) && !question.correct.length}
						<p class="text-sm text-yellow-400">
							Tick the correct answer with the check button, otherwise this question is worth
							nothing.
						</p>
					{/if}
				{/if}

				{#if validationsFor(question.type).length}
					<div class="flex flex-col gap-2">
						<p class="text-sm font-medium">Answer rules</p>
						<ValidationEditor bind:rules={question.validationRules} type={question.type} />
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
