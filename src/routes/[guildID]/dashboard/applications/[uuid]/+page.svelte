<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import ImageUp from '@lucide/svelte/icons/image-up';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { guildData } from '$lib/dashboardData.svelte';
	import QuestionEditor from '$lib/components/applications/QuestionEditor.svelte';
	import FormPreview from '$lib/components/applications/FormPreview.svelte';
	import ResponsesPanel from '$lib/components/applications/ResponsesPanel.svelte';
	import MessageEditor from '$lib/components/discord/MessageEditor.svelte';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import ColorPicker from '$lib/components/settings/ColorPicker.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import {
		applicationVariables,
		blankQuestion,
		descriptionLimit,
		formMaximum,
		openEnded,
		maxAccountAge,
		maxCooldown,
		messageLimit,
		newId,
		presetLimit,
		questionGroups,
		questionKinds,
		questionLimit,
		responseLimit,
		titleLimit,
		type Preset,
		type Question,
		type QuestionType
	} from '$lib/applications';
	import { isEmptyMessage, type DiscordMessage } from '$lib/discord';
	import { editable } from '$lib/settingsForm.svelte';
	import { toast } from '$lib/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.application);

	const tabs = [
		{ value: 'questions', label: 'Questions' },
		{ value: 'settings', label: 'Settings' },
		{ value: 'responses', label: 'Responses' }
	];

	const shell =
		'min-h-10 w-full rounded-lg border border-line bg-white/5 pointer-coarse:min-h-11 px-3 py-2 text-sm pointer-coarse:min-h-11 placeholder:text-muted focus:border-white/25 focus:ring-0';

	let tab = $state('questions');
	let openQuestion = $state('');
	let adding = $state(false);
	let preview = $state(false);
	let dragged = $state(-1);
	let uploading = $state(false);
	let picker = $state<HTMLInputElement>();
	let removing = $state(false);
	let answers = $state<Record<string, unknown>>({});
	let editingPreset = $state<{ list: Preset[]; position: number } | null>(null);
	let erlc = $state<Awaited<PageData['erlc']>>({
		players: [],
		offline: false,
		unconfigured: false
	});

	$effect(() => {
		data.erlc.then((next) => (erlc = next));
	});

	let editorOpen = $state(false);
	let editorTitle = $state('');
	let editorMessage = $state<DiscordMessage | null>(null);

	function openEditor(message: DiscordMessage, title: string) {
		editorMessage = message;
		editorTitle = title;
		editorOpen = true;
	}

	const banner = $derived(form.value.bannerUrl.trim());
	const bannerBroken = $derived(!!banner && !banner.startsWith('https://'));
	const maximum = $derived(formMaximum(form.value));
	const unmarkable = $derived(openEnded(form.value));
	const questionCount = $derived(form.value.questions.length);

	async function upload(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		const body = new FormData();
		body.append('file', file);
		uploading = true;

		try {
			const response = await fetch(`/api/upload/${data.guild.id}`, { method: 'POST', body });
			const payload = (await response.json().catch(() => ({}))) as {
				url?: string;
				message?: string;
			};

			if (!response.ok || !payload.url) {
				toast(payload.message ?? 'That upload did not go through.', 'error');
				return;
			}

			form.value.bannerUrl = payload.url;
			toast('Banner uploaded, save to publish it.', 'success');
		} catch {
			toast('That upload did not go through.', 'error');
		} finally {
			uploading = false;
		}
	}

	function addQuestion(type: QuestionType) {
		if (form.value.questions.length >= questionLimit) return;

		const question = blankQuestion(type, form.value.scoring.defaultPoints);
		form.value.questions.push(question);
		openQuestion = question.id;
		adding = false;
	}

	function duplicate(position: number) {
		const source = $state.snapshot(form.value.questions[position]) as Question;
		const copy: Question = {
			...source,
			id: newId(),
			validationRules: source.validationRules.map((rule) => ({ ...rule, id: newId() }))
		};

		form.value.questions.splice(position + 1, 0, copy);
		openQuestion = copy.id;
	}

	function remove(position: number) {
		form.value.questions.splice(position, 1);
	}

	function move(position: number, target: number) {
		if (target < 0 || target >= form.value.questions.length) return;

		const [question] = form.value.questions.splice(position, 1);
		form.value.questions.splice(target, 0, question);
	}

	function drop(position: number) {
		if (dragged !== -1 && dragged !== position) move(dragged, position);
		dragged = -1;
	}

	function addPreset(list: Preset[]) {
		if (list.length >= presetLimit) return;

		list.push({ name: '', value: '' });
		editingPreset = { list, position: list.length - 1 };
	}

	function closePreset() {
		if (!editingPreset) return;

		const { list, position } = editingPreset;
		const entry = list[position];
		if (!entry.name.trim() && !entry.value.trim()) list.splice(position, 1);

		editingPreset = null;
	}
</script>

<svelte:head><title>{form.value.title || 'Application'} - {guildData.name}</title></svelte:head>

<div class="mx-auto w-full max-w-5xl">
	<input
		bind:this={picker}
		type="file"
		accept="image/*"
		onchange={upload}
		class="hidden"
		aria-label="Upload a banner"
	/>

	<div class="flex flex-wrap items-start gap-4">
		<a
			href={resolve('/[guildID]/dashboard/applications', { guildID: data.guild.id })}
			aria-label="Back to applications"
			class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-white/5 hover:text-white"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>

		<div class="min-w-0 flex-1">
			<p class="text-xs text-muted">Applications</p>
			<h1 class="mt-1 truncate text-3xl font-bold tracking-[-0.03em]">
				{form.value.title || 'Untitled application'}
			</h1>
			<p class="mt-2 text-muted">
				{questionCount === 1 ? '1 question' : `${questionCount} questions`}
				{form.value.acceptingResponses ? '- Accepting Responses' : '- Closed'}
			</p>
		</div>
	</div>

	<div class="mt-6 flex flex-wrap items-stretch gap-3">
		{#if preview}
			<p
				class="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-muted"
			>
				<Eye class="h-4 w-4 shrink-0" />
				This is how applicants see the form.
			</p>
		{:else}
			<div
				class="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1"
			>
				{#each tabs as entry (entry.value)}
					<button
						type="button"
						onclick={() => (tab = entry.value)}
						aria-current={tab === entry.value}
						class="flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors pointer-coarse:py-3 {tab ===
						entry.value
							? 'bg-white text-bg'
							: 'text-muted hover:bg-white/5 hover:text-white'}"
					>
						{entry.label}

						{#if entry.value === 'responses'}
							{#await data.responses then list}
								{#if list?.length}
									{@const waiting = list.filter((one) => one.reviewStatus === 'unreviewed').length}
									<span
										class="rounded-full px-2 py-0.5 text-xs font-semibold {waiting
											? 'bg-red-500 text-white'
											: tab === entry.value
												? 'bg-bg/10 text-bg'
												: 'bg-white/10 text-muted'}"
									>
										{list.length}
									</span>
								{/if}
							{/await}
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		<button
			type="button"
			onclick={() => {
				tab = 'questions';
				preview = !preview;
			}}
			class="flex shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/5"
		>
			{#if preview}
				<EyeOff class="h-4 w-4" />
				Back to editing
			{:else}
				<Eye class="h-4 w-4" />
				Preview form
			{/if}
		</button>
	</div>

	{#if tab === 'questions'}
		<div class="mt-6 flex flex-col gap-6">
			{#if !preview}
				<div class="relative overflow-hidden rounded-xl border border-line bg-surface">
					{#if banner && !bannerBroken}
						<img src={banner} alt="" class="h-44 w-full object-cover" />

						<div class="absolute top-3 right-3 flex gap-2">
							<button
								type="button"
								onclick={() => picker?.click()}
								disabled={uploading}
								class="flex items-center gap-2 rounded-lg border border-line bg-bg/70 px-3 py-1.5 text-xs font-semibold backdrop-blur transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3.5"
							>
								{#if uploading}
									<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
									Uploading
								{:else}
									<ImageUp class="h-3.5 w-3.5" />
									Change
								{/if}
							</button>

							<button
								type="button"
								onclick={() => (form.value.bannerUrl = '')}
								class="flex items-center gap-2 rounded-lg border border-line bg-bg/70 px-3 py-1.5 text-xs font-semibold text-muted backdrop-blur transition-colors hover:bg-bg hover:text-white pointer-coarse:py-3.5"
							>
								<Trash2 class="h-3.5 w-3.5" />
								Remove
							</button>
						</div>
					{:else}
						<button
							type="button"
							onclick={() => picker?.click()}
							disabled={uploading}
							class="flex h-44 w-full flex-col items-center justify-center gap-2 text-muted transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{#if uploading}
								<LoaderCircle class="h-5 w-5 animate-spin" />
								<span class="text-sm font-semibold">Uploading</span>
							{:else}
								<ImageUp class="h-5 w-5" />
								<span class="text-sm font-semibold">Add a banner</span>
								<span class="text-xs">
									{bannerBroken
										? 'That link is not https, so applicants will not see it.'
										: 'Shown across the top of the form for applicants.'}
								</span>
							{/if}
						</button>
					{/if}
				</div>

				<Card title="Form Details" description="The title and intro applicants see at the top.">
					<div class="grid gap-5 px-6 py-5">
						<Field label="Title" counter="{form.value.title.length}/{titleLimit}">
							<Input
								bind:value={form.value.title}
								maxlength={titleLimit}
								placeholder="Staff application"
							/>
						</Field>

						<Field
							label="Description"
							description="Markdown works here, so **bold**, *italic*, lists and links all render."
							counter="{form.value.description.length}/{descriptionLimit}"
						>
							<div class="flex flex-col gap-2">
								<textarea
									bind:value={form.value.description}
									maxlength={descriptionLimit}
									rows={3}
									placeholder="What this form is for and who should fill it in."
									aria-label="Application description"
									class={shell}></textarea>
							</div>
						</Field>
					</div>
				</Card>

				<p class="text-sm text-muted">
					{form.value.questions.length}/{questionLimit} questions
					{form.value.scoring.enabled ? `- ${maximum} points available` : ''}
				</p>
			{/if}

			{#if preview}
				<div class="mx-auto w-full max-w-3xl">
					<FormPreview form={form.value} bind:answers />

					{#if !form.value.questions.length}
						<p class="mt-4 text-center text-sm text-muted">Add a question to see the form.</p>
					{/if}
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each form.value.questions as question, position (question.id)}
						<div
							role="listitem"
							draggable={openQuestion !== question.id}
							ondragstart={() => (dragged = position)}
							ondragover={(event) => event.preventDefault()}
							ondrop={(event) => {
								event.preventDefault();
								drop(position);
							}}
							ondragend={() => (dragged = -1)}
							class={dragged === position ? 'opacity-50' : ''}
						>
							<QuestionEditor
								bind:question={form.value.questions[position]}
								{position}
								total={form.value.questions.length}
								scoring={form.value.scoring.enabled}
								expanded={openQuestion === question.id}
								ontoggle={() => (openQuestion = openQuestion === question.id ? '' : question.id)}
								onmove={(direction) => move(position, position + direction)}
								onduplicate={() => duplicate(position)}
								ondelete={() => remove(position)}
							/>
						</div>
					{:else}
						<p
							class="rounded-xl border border-line bg-surface px-6 py-10 text-center text-sm text-muted"
						>
							No questions yet. Add your first one below.
						</p>
					{/each}
				</div>

				<div class="relative">
					<button
						type="button"
						onclick={() => (adding = !adding)}
						disabled={form.value.questions.length >= questionLimit}
						class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface px-4 py-4 text-sm font-semibold transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<Plus class="h-4 w-4" />
						Add question
					</button>

					{#if adding}
						<div
							class="mt-3 rounded-xl border border-line bg-surface p-4"
							transition:fly={{ y: -6, duration: 150 }}
						>
							{#each questionGroups as group (group)}
								<p class="px-1 pt-3 pb-2 text-xs font-semibold text-muted first:pt-0">{group}</p>

								<div class="grid grid-cols-2 gap-2 lg:grid-cols-3">
									{#each questionKinds.filter((kind) => kind.group === group) as kind (kind.value)}
										{@const Icon = kind.icon}
										<button
											type="button"
											onclick={() => addQuestion(kind.value)}
											class="flex items-start gap-3 rounded-lg border border-line bg-white/2 p-3 text-left transition-colors hover:bg-white/8"
										>
											<Icon class="mt-0.5 h-4 w-4 shrink-0" />
											<span class="min-w-0">
												<span class="block text-sm font-medium">{kind.label}</span>
												<span class="block text-xs text-muted">{kind.description}</span>
											</span>
										</button>
									{/each}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{:else if tab === 'settings'}
		<div class="mt-6 flex flex-col gap-6">
			<div class="flex flex-col gap-6">
				<div class="contents">
					<Card
						collapsible
						title="Availability"
						description="Whether people can send this form in right now."
					>
						<Row label="Accepting Responses" description="Turn this off to close the form." tight>
							<Switch bind:checked={form.value.acceptingResponses} label="Accepting responses" />
						</Row>

						<Row label="Closed Message" description="Shown when the form is closed." wide>
							<textarea
								bind:value={form.value.closedMessage}
								maxlength={messageLimit}
								rows={2}
								placeholder="Applications reopen at the start of every month."
								aria-label="Closed message"
								class={shell}></textarea>
						</Row>

						<Row label="Submitted Message" description="Shown right after someone applies." wide>
							<textarea
								bind:value={form.value.submittedMessage}
								maxlength={messageLimit}
								rows={2}
								placeholder="Thanks, we will get back to you within a week."
								aria-label="Submitted message"
								class={shell}></textarea>
						</Row>

						<Row label="Cooldown" description="Days before someone can apply again." tight>
							<div class="w-40">
								<Input
									type="number"
									min={0}
									max={maxCooldown}
									bind:value={form.value.cooldown}
									suffix="days"
								/>
							</div>
						</Row>

						<Row
							label="Max Responses"
							description="How many times one person can apply. Leave blank for no limit."
							tight
						>
							<div class="w-40">
								<Input
									type="number"
									min={1}
									max={responseLimit}
									placeholder="Unlimited"
									bind:value={
										() => form.value.maxResponses || '',
										(next) => (form.value.maxResponses = Math.max(0, Math.trunc(Number(next) || 0)))
									}
								/>
							</div>
						</Row>

						<Row
							label="Minimum Account Age"
							description="How old a Discord account has to be to apply."
							tight
						>
							<div class="w-40">
								<Input
									type="number"
									min={0}
									max={maxAccountAge}
									bind:value={form.value.minimumAccountAge}
									suffix="days"
								/>
							</div>
						</Row>

						<Row label="Max Logs" description="Set to zero for no limit on stored responses." tight>
							<div class="w-40">
								<Input type="number" min={0} max={1000} bind:value={form.value.maxLogs} />
							</div>
						</Row>
					</Card>
				</div>
				<div class="contents">
					<Card collapsible title="Presentation" description="How the form looks to applicants.">
						<div class="grid gap-5 px-6 py-5">
							<Field label="Banner" description="Upload an image or paste an https link.">
								<div class="flex gap-2">
									<div class="min-w-0 flex-1">
										<Input
											bind:value={form.value.bannerUrl}
											placeholder="https://example.com/banner.png"
										/>
									</div>

									<button
										type="button"
										onclick={() => picker?.click()}
										disabled={uploading}
										class="flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-line bg-white/5 px-3 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
									>
										{#if uploading}
											<LoaderCircle class="h-4 w-4 animate-spin" />
											Uploading
										{:else}
											<ImageUp class="h-4 w-4" />
											Upload
										{/if}
									</button>
								</div>

								{#if form.value.bannerUrl.trim()}
									<img
										src={form.value.bannerUrl.trim()}
										alt=""
										class="mt-3 h-28 w-full rounded-lg border border-line object-cover"
									/>
								{/if}
							</Field>
						</div>

						<Row label="Theme Colour" description="Tints the form and its embeds." tight>
							<ColorPicker bind:value={form.value.themeColor} label="Theme colour" />
						</Row>
					</Card>
				</div>
				<div class="contents">
					<Card collapsible title="Results" description="Where decisions are posted and when.">
						<Row label="Results Channel" description="Approvals and denials are logged here.">
							<ChannelSelect bind:value={form.value.resultsChannel} />
						</Row>

						<Row label="Alert Channel" description="New submissions are announced here.">
							<ChannelSelect bind:value={form.value.alertChannel} />
						</Row>

						<Row label="Alert Roles" description="Pinged when a submission arrives." wide>
							<Roles bind:selected={form.value.alertRoles} placeholder="No ping" />
						</Row>

						<Row
							label="Stage Responses"
							description="Hold decisions back until you publish them together."
							tight
						>
							<Switch bind:checked={form.value.stageResponses} label="Stage responses" />
						</Row>

						<Callout>
							Staged decisions stay hidden from applicants until you publish them from the Responses
							tab.
						</Callout>
					</Card>
				</div>
				<div class="contents">
					<Card
						collapsible
						title="Who Can Apply"
						description="Requirements checked before the form opens."
					>
						<Row label="Required Roles" description="Applicants need one of these." wide>
							<Roles bind:selected={form.value.requiredRoles} placeholder="Anyone can apply" />
						</Row>

						<Row label="Blacklisted Roles" description="Anyone with these cannot apply." wide>
							<Roles bind:selected={form.value.blacklistedRoles} placeholder="No blocked roles" />
						</Row>

						<Row label="Editor Roles" description="Who can review and edit this form." wide>
							<Roles bind:selected={form.value.editorRoles} placeholder="Management only" />
						</Row>

						<Row label="Require ROBLOX" description="Applicants must link a ROBLOX account." tight>
							<Switch bind:checked={form.value.robloxRequired} label="Require ROBLOX" />
						</Row>

						<Row label="Ban Appeal" description="Treat this form as a ban appeal." tight>
							<Switch bind:checked={form.value.isBanAppeal} label="Ban appeal" />
						</Row>
					</Card>
				</div>
				<div class="contents">
					<Card
						collapsible
						title="Roles On Review"
						description="Applied automatically when you decide."
					>
						<Row label="Added On Approval" description="Given when someone is approved." wide>
							<Roles bind:selected={form.value.rolesAddedOnApproval} placeholder="No roles" />
						</Row>

						<Row
							label="Removed On Approval"
							description="Taken away when someone is approved."
							wide
						>
							<Roles bind:selected={form.value.rolesRemovedOnApproval} placeholder="No roles" />
						</Row>

						<Row label="Removed On Denial" description="Taken away when someone is denied." wide>
							<Roles bind:selected={form.value.rolesRemovedOnDenial} placeholder="No roles" />
						</Row>
					</Card>
				</div>
				<div class="contents">
					<Card
						collapsible
						title="Scoring"
						description="Score answers and grade them automatically."
					>
						<Row label="Enable Scoring" description="Points come from each question." tight>
							<Switch bind:checked={form.value.scoring.enabled} label="Enable scoring" />
						</Row>

						<div
							inert={!form.value.scoring.enabled}
							class={form.value.scoring.enabled ? '' : 'opacity-40'}
						>
							<Row
								label="Default Question Points"
								description="New questions start worth this many points."
								tight
							>
								<div class="w-40">
									<Input
										type="number"
										min={0}
										bind:value={form.value.scoring.defaultPoints}
										suffix="pts"
									/>
								</div>
							</Row>

							<Row
								label="Grade Automatically"
								description="Decide the outcome from the score as soon as someone applies."
								tight
							>
								<Switch bind:checked={form.value.scoring.autoGrade} label="Grade automatically" />
							</Row>

							<div
								inert={!form.value.scoring.autoGrade}
								class={form.value.scoring.autoGrade ? '' : 'opacity-40'}
							>
								<Row
									label="Minimum Points Threshold"
									description="Reach this and the application is approved, otherwise it is denied. This form is worth {maximum} points."
									tight
								>
									<div class="w-40">
										<Input
											type="number"
											min={0}
											bind:value={form.value.scoring.minimumPoints}
											suffix="pts"
										/>
									</div>
								</Row>
							</div>

							{#if form.value.scoring.autoGrade && !form.value.scoring.minimumPoints && !unmarkable.length}
								<Callout tone="warning">
									A threshold of zero approves every applicant the moment they apply. Set a minimum
									above zero unless that is what you want.
								</Callout>
							{/if}

							{#if form.value.scoring.autoGrade && unmarkable.length}
								<Callout tone="warning">
									{unmarkable.length === 1
										? 'One question needs'
										: `${unmarkable.length} questions need`}
									a written answer, so this form cannot be graded automatically. Every question has to
									be multiple choice, checkboxes or a dropdown. Applications will wait for a reviewer
									as normal.
								</Callout>
							{/if}

							<Row label="Show Score" description="Applicants see their own score." tight>
								<Switch bind:checked={form.value.scoring.showApplicants} label="Show score" />
							</Row>

							<Row
								label="Let Applicants Review"
								description="Once a decision is sent, applicants can reopen their answers and score."
								tight
							>
								<Switch
									bind:checked={form.value.scoring.allowReview}
									label="Let applicants review"
								/>
							</Row>
						</div>
					</Card>
				</div>
			</div>
			<div class="flex flex-col gap-6">
				{#snippet embedRow(title: string, description: string, message: DiscordMessage)}
					<button
						type="button"
						onclick={() => openEditor(message, title)}
						class="flex w-full items-center gap-3 rounded-lg border border-line bg-white/2 px-4 py-3 text-left transition-colors hover:bg-white/5"
					>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium">{title}</p>
							<p class="mt-0.5 text-xs text-muted">{description}</p>
						</div>
						<span
							class="shrink-0 rounded-md border border-line px-2 py-0.5 text-xs {isEmptyMessage(
								message
							)
								? 'text-muted'
								: 'bg-white/10 text-white'}"
						>
							{isEmptyMessage(message) ? 'Default' : 'Custom'}
						</span>
					</button>
				{/snippet}

				<Card
					title="Decision Embeds"
					description="Custom messages sent when you accept or deny an application."
				>
					<div class="grid gap-6 px-6 py-5 lg:grid-cols-2">
						<div class="flex flex-col gap-3">
							<p class="text-sm font-medium">Acceptance</p>
							{@render embedRow(
								'Acceptance DM',
								'Sent to the applicant when accepted.',
								form.value.decisionEmbeds.acceptDM
							)}
							{@render embedRow(
								'Acceptance public post',
								'Posted in the results channel when accepted.',
								form.value.decisionEmbeds.acceptPublic
							)}
						</div>

						<div class="flex flex-col gap-3">
							<p class="text-sm font-medium">Denial</p>
							{@render embedRow(
								'Denial DM',
								'Sent to the applicant when denied.',
								form.value.decisionEmbeds.denyDM
							)}
							{@render embedRow(
								'Denial public post',
								'Posted in the results channel when denied.',
								form.value.decisionEmbeds.denyPublic
							)}
						</div>
					</div>

					<Callout>
						Leave one blank to use the built-in message. Public posts are only sent when a results
						channel is set.
					</Callout>
				</Card>

				<Card title="Response Presets" description="Saved messages for approvals and denials.">
					<div class="grid gap-6 px-6 py-5 lg:grid-cols-2">
						{#each [{ label: 'Accept presets', list: form.value.acceptPresets }, { label: 'Deny presets', list: form.value.denyPresets }] as group (group.label)}
							<div class="flex flex-col gap-3">
								<div class="flex items-center gap-2">
									<p class="min-w-0 flex-1 text-sm font-medium">{group.label}</p>

									<button
										type="button"
										onclick={() => addPreset(group.list)}
										disabled={group.list.length >= presetLimit}
										class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3.5"
									>
										<Plus class="h-3.5 w-3.5" />
										Add
									</button>
								</div>

								{#each group.list as entry, position (position)}
									<div
										class="flex items-center gap-2 rounded-lg border border-line bg-white/2 px-3 py-2"
									>
										<p class="min-w-0 flex-1 truncate text-sm">
											{entry.name || 'Untitled preset'}
										</p>

										<button
											type="button"
											onclick={() => (editingPreset = { list: group.list, position })}
											aria-label="Edit preset"
											class="shrink-0 rounded-lg border border-line bg-white/5 p-2 text-muted transition-colors hover:bg-white/10 hover:text-white"
										>
											<Pencil class="h-4 w-4" />
										</button>

										<button
											type="button"
											onclick={() => group.list.splice(position, 1)}
											aria-label="Remove preset"
											class="shrink-0 rounded-lg border border-line bg-white/5 p-2 text-muted transition-colors hover:bg-white/10 hover:text-white"
										>
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
								{:else}
									<p class="text-sm text-muted">No presets yet.</p>
								{/each}
							</div>
						{/each}
					</div>
				</Card>

				<Card title="Danger Zone" description="Deleting this form also deletes every response.">
					<div class="flex flex-wrap items-center gap-4 px-6 py-5">
						<p class="min-w-0 flex-1 text-sm text-muted">
							This cannot be undone, and applicants lose access straight away.
						</p>

						<button
							type="button"
							onclick={() => (removing = true)}
							class="flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 pointer-coarse:py-3"
						>
							<Trash2 class="h-4 w-4" />
							Delete application
						</button>
					</div>
				</Card>
			</div>
		</div>
	{:else}
		<div class="mt-6 flex flex-col gap-6">
			{#if form.value.isBanAppeal && (erlc.unconfigured || erlc.offline)}
				<Card title="ER:LC server" description="Where accepted appeals are unbanned.">
					<Callout tone="warning">
						{erlc.unconfigured
							? 'No ER:LC server key is linked here, so accepting a ban appeal will not unban anyone.'
							: 'Nobody is in your ER:LC server, so it reads as offline. Accepting a ban appeal now will not unban anyone.'}
					</Callout>
				</Card>
			{/if}

			{#await data.responses}
				<div class="skeleton h-40 rounded-xl bg-white/8"></div>
			{:then responses}
				{#if responses}
					<ResponsesPanel application={form.value} {responses} players={erlc.players} />
				{:else}
					<p
						class="rounded-xl border border-line bg-surface px-6 py-10 text-center text-sm text-muted"
					>
						Responses are unavailable right now, try again shortly.
					</p>
				{/if}
			{/await}
		</div>
	{/if}
</div>

<SaveBar
	{form}
	blocked={!form.value.title.trim()}
	blockedLabel="Give this application a title first"
/>

{#if removing}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (removing = false)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-88 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">Delete this application?</h2>
		<p class="mt-2 text-sm text-muted">
			Every question and response is deleted with it. This cannot be undone.
		</p>

		<form
			method="POST"
			action="?/deleteApplication"
			use:enhance={() => {
				form.reset();

				return async ({ result, update }) => {
					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not delete this application.'), 'error');
						removing = false;
						return;
					}

					await update();
				};
			}}
			class="mt-6 flex gap-2"
		>
			<button
				type="button"
				onclick={() => (removing = false)}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="submit"
				class="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				Delete
			</button>
		</form>
	</div>
{/if}

{#if editingPreset}
	{@const entry = editingPreset.list[editingPreset.position]}

	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={closePreset}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-120 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">Preset</h2>
		<p class="mt-2 text-sm text-muted">
			Reviewers pick this by name, and the message goes out with the decision.
		</p>

		<div class="mt-4 flex flex-col gap-3">
			<Input bind:value={entry.name} maxlength={100} placeholder="Preset name" />

			<textarea
				bind:value={entry.value}
				maxlength={messageLimit}
				rows={5}
				placeholder="The message sent with this decision."
				aria-label="Preset message"
				class={shell}></textarea>
		</div>

		<button
			type="button"
			onclick={closePreset}
			class="mt-6 w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
		>
			Done
		</button>
	</div>
{/if}

{#if editorMessage}
	<MessageEditor
		bind:open={editorOpen}
		message={editorMessage}
		title={editorTitle}
		variables={applicationVariables}
	/>
{/if}
