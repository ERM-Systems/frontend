<script lang="ts">
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import DatePicker from '$lib/components/settings/DatePicker.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import {
		newId,
		validationsFor,
		type QuestionType,
		type ValidationParams,
		type ValidationRule,
		type ValidationType
	} from '$lib/applications';

	let {
		rules = $bindable(),
		type
	}: {
		rules: ValidationRule[];
		type: QuestionType;
	} = $props();

	const ruleLimit = 10;
	const dateShell =
		'min-h-10 w-full rounded-lg border border-line bg-white/5 pointer-coarse:min-h-11 px-3 py-2 text-sm pointer-coarse:min-h-11 placeholder:text-muted focus:border-white/25 focus:ring-0';

	const defaults: Record<ValidationType, ValidationParams> = {
		length: { minLength: 0, maxLength: 500 },
		words: { minWords: 0, maxWords: 200 },
		sentences: { minSentences: 1 },
		range: { minValue: 0, maxValue: 100 },
		regex: { pattern: '' },
		contains: { text: '', caseSensitive: false },
		excludes: { text: '', caseSensitive: false },
		startsWith: { text: '', caseSensitive: false },
		endsWith: { text: '', caseSensitive: false },
		customList: { allowedValues: [], caseSensitive: false },
		dateRange: { minDate: '', maxDate: '' },
		choiceCount: { minChoices: 1, maxChoices: 5 }
	};

	function fill(rule: ValidationRule) {
		const params = rule.params as Record<string, unknown>;
		for (const [key, value] of Object.entries(defaults[rule.type] ?? {})) {
			if (params[key] === undefined) params[key] = value;
		}
	}

	for (const rule of rules) fill(rule);

	const kinds = $derived(validationsFor(type));
	const options = $derived(
		kinds.map((kind) => ({ value: kind.value, label: kind.label, hint: kind.description }))
	);

	let picked = $state<string>('');

	function add(choice: string) {
		const kind = kinds.find((entry) => entry.value === choice);
		if (!kind || rules.length >= ruleLimit) return;

		const rule: ValidationRule = { id: newId(), type: kind.value, params: {}, errorMessage: '' };
		fill(rule);
		rules.push(rule);
		picked = '';
	}

	function remove(position: number) {
		rules.splice(position, 1);
	}

	function label(rule: ValidationRule): string {
		return kinds.find((kind) => kind.value === rule.type)?.label ?? rule.type;
	}

	function listText(rule: ValidationRule): string {
		return (rule.params.allowedValues ?? []).join('\n');
	}

	function setList(rule: ValidationRule, value: string) {
		rule.params.allowedValues = value
			.split('\n')
			.map((entry) => entry.trim())
			.filter(Boolean);
	}
</script>

{#if kinds.length}
	<div class="flex flex-col gap-3">
		{#each rules as rule, position (rule.id)}
			{@const params = rule.params as Required<ValidationParams>}
			<div class="rounded-lg border border-line bg-white/2 p-4">
				<div class="flex items-center gap-3">
					<p class="min-w-0 flex-1 truncate text-sm font-medium">{label(rule)}</p>

					<button
						type="button"
						onclick={() => remove(position)}
						aria-label="Remove rule"
						class="shrink-0 rounded-lg border border-line bg-white/5 p-2 text-muted transition-colors hover:bg-white/10 hover:text-white"
					>
						<Trash2 class="h-4 w-4" />
					</button>
				</div>

				<div class="mt-3 grid gap-3 sm:grid-cols-2">
					{#if rule.type === 'length'}
						<Input type="number" min={0} bind:value={params.minLength} suffix="min" />
						<Input type="number" min={0} bind:value={params.maxLength} suffix="max" />
					{:else if rule.type === 'words'}
						<Input type="number" min={0} bind:value={params.minWords} suffix="min" />
						<Input type="number" min={0} bind:value={params.maxWords} suffix="max" />
					{:else if rule.type === 'sentences'}
						<Input type="number" min={0} bind:value={params.minSentences} suffix="min" />
					{:else if rule.type === 'range'}
						<Input type="number" bind:value={params.minValue} suffix="min" />
						<Input type="number" bind:value={params.maxValue} suffix="max" />
					{:else if rule.type === 'choiceCount'}
						<Input type="number" min={0} bind:value={params.minChoices} suffix="min" />
						<Input type="number" min={0} bind:value={params.maxChoices} suffix="max" />
					{:else if rule.type === 'regex'}
						<div class="sm:col-span-2">
							<Input bind:value={params.pattern} placeholder="^[A-Za-z ]+$" />
						</div>
					{:else if rule.type === 'dateRange'}
						<DatePicker
							bind:value={params.minDate}
							label="Earliest date"
							placeholder="Earliest date"
							clearable
						/>
						<DatePicker
							bind:value={params.maxDate}
							label="Latest date"
							placeholder="Latest date"
							clearable
						/>
					{:else if rule.type === 'customList'}
						<div class="sm:col-span-2">
							<textarea
								value={listText(rule)}
								oninput={(event) => setList(rule, event.currentTarget.value)}
								rows={4}
								aria-label="Accepted answers"
								placeholder="One accepted answer per line"
								class={dateShell}></textarea>
						</div>
					{:else}
						<div class="sm:col-span-2">
							<Input bind:value={params.text} placeholder="Some text" />
						</div>
					{/if}

					{#if rule.params.caseSensitive !== undefined}
						<label class="flex items-center gap-3 text-sm text-muted">
							<Switch bind:checked={params.caseSensitive} label="Case sensitive" />
							Case sensitive
						</label>
					{/if}

					<div class="sm:col-span-2">
						<Input
							bind:value={rule.errorMessage}
							maxlength={200}
							placeholder="Custom error message (optional)"
						/>
					</div>
				</div>
			</div>
		{/each}

		{#if rules.length < ruleLimit}
			<Select {options} bind:value={picked} placeholder="Add a rule" onchange={add} />
		{:else}
			<p class="text-sm text-muted">That is the most rules one question can have.</p>
		{/if}
	</div>
{:else}
	<p class="text-sm text-muted">This question type has no extra rules.</p>
{/if}
