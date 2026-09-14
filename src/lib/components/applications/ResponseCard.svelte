<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { slide } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import Markdown from '$lib/components/Markdown.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import {
		answerText,
		answerable,
		messageLimit,
		type ApplicationForm,
		type ApplicationResponse,
		type LivePlayer
	} from '$lib/applications';
	import { defaultAvatar, exactTime } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';

	let {
		response,
		application,
		expanded,
		ontoggle,
		onchanged,
		live = null
	}: {
		response: ApplicationResponse;
		application: ApplicationForm;
		expanded: boolean;
		ontoggle: () => void;
		onchanged: () => void;
		live?: LivePlayer | null;
	} = $props();

	const shell =
		'min-h-10 w-full rounded-lg border border-line bg-white/5 pointer-coarse:min-h-11 px-3 py-2 text-sm pointer-coarse:min-h-11 placeholder:text-muted focus:border-white/25 focus:ring-0';

	const pending = $derived(response.reviewStatus === 'unreviewed');
	const locked = $derived(!pending && !response.staged);
	let staging = $derived(response.staged);
	const denied = $derived(response.reviewStatus === 'denied');
	const status = $derived(pending ? 'Pending' : denied ? 'Denied' : 'Approved');
	const tint = $derived(pending ? 'text-yellow-400' : denied ? 'text-red-400' : 'text-green-400');

	const questions = $derived(application.questions.filter((entry) => answerable(entry.type)));
	const presets = $derived([
		...application.acceptPresets.map((entry) => ({ ...entry, label: `Accept - ${entry.name}` })),
		...application.denyPresets.map((entry) => ({ ...entry, label: `Deny - ${entry.name}` }))
	]);

	let reason = $state('');
	let comment = $state('');
	let preset = $state('');
	let working = $state(false);

	function avatarUrl(discordID: string, hash: string): string {
		return hash
			? `https://cdn.discordapp.com/avatars/${discordID}/${hash}.png`
			: 'https://cdn.discordapp.com/embed/avatars/0.png';
	}

	function stamp(value: string): string {
		const parsed = Date.parse(value);
		return Number.isFinite(parsed) ? exactTime(parsed / 1000) : 'Unknown';
	}

	function applyPreset(name: string) {
		const found = presets.find((entry) => entry.label === name);
		if (found) reason = found.value;
	}
</script>

<div class="rounded-xl border border-line bg-surface">
	<div class="flex flex-wrap items-center gap-3 px-4 py-3">
		<img
			src={avatarUrl(response.discordID, response.avatar)}
			alt=""
			onerror={(event) => {
				const image = event.currentTarget as HTMLImageElement;
				const fallback = defaultAvatar(response.discordID);
				if (image.src !== fallback) image.src = fallback;
			}}
			class="h-9 w-9 shrink-0 rounded-full"
		/>

		<button
			type="button"
			onclick={ontoggle}
			aria-expanded={expanded}
			class="flex min-w-0 flex-1 items-center gap-3 text-left"
		>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-sm font-medium">{response.username}</span>
				<span class="block truncate text-xs text-muted">
					{response.discordID} - {stamp(response.submittedAt)}
				</span>
			</span>
		</button>

		{#if response.staged}
			<span class="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-muted">
				Staged
			</span>
		{/if}

		{#if application.scoring.enabled && response.score}
			<span class="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-muted">
				{response.score.total}/{response.score.max}
			</span>
		{/if}

		<span class="shrink-0 text-xs font-semibold {tint}">{status}</span>

		<form
			method="POST"
			action="?/deleteResponse"
			use:enhance={() => {
				working = true;

				return async ({ result }) => {
					working = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not delete that response.'), 'error');
						return;
					}

					toast('Response deleted.', 'success');
					onchanged();
				};
			}}
			class="shrink-0"
		>
			<input type="hidden" name="responseID" value={response.responseID} />

			<button
				type="submit"
				disabled={working}
				aria-label="Delete response"
				class="rounded-lg border border-line p-2.5 text-muted transition-colors hover:bg-white/5 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
			>
				<Trash2 class="h-4 w-4" />
			</button>
		</form>

		<button
			type="button"
			onclick={ontoggle}
			aria-label="Toggle response"
			class="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-white/10 hover:text-white"
		>
			<ChevronDown class="h-4 w-4 {expanded ? 'rotate-180' : ''} transition-transform" />
		</button>
	</div>

	{#if expanded}
		<div
			class="flex flex-col gap-5 border-t border-line px-4 py-5"
			transition:slide={{ duration: 160 }}
		>
			{#if response.roblox}
				<div class="flex items-center gap-3 rounded-lg border border-line bg-white/2 p-3">
					{#if response.roblox.thumbnailURL}
						<img src={response.roblox.thumbnailURL} alt="" class="h-10 w-10 rounded-lg" />
					{/if}

					<div class="min-w-0">
						<p class="truncate text-sm font-medium">{response.roblox.username}</p>
						<p class="truncate text-xs text-muted">
							ID {response.roblox.robloxID}{response.roblox.joinDate
								? ` - joined ${response.roblox.joinDate}`
								: ''}
						</p>
					</div>

					{#if live}
						<span
							class="ml-auto shrink-0 rounded-full border border-green-400/30 bg-green-400/10 px-2.5 py-1 text-xs font-semibold text-green-300"
						>
							In server as {live.team}
						</span>
					{/if}
				</div>
			{/if}

			{#if application.scoring.enabled && response.score}
				<div class="rounded-lg border border-line bg-white/2 p-3 text-sm">
					<p>
						Scored <span class="font-semibold text-white"
							>{response.score.total} of {response.score.max}</span
						>.
					</p>
					<p class="mt-1 {response.score.passed ? 'text-green-400' : 'text-yellow-400'}">
						{response.score.passed ? 'Met the minimum' : 'Below the minimum'} of {application
							.scoring.minimumPoints} points
					</p>
				</div>
			{/if}

			<div class="flex flex-col gap-4">
				{#each questions as question (question.id)}
					<div>
						<p class="text-sm font-medium">{question.title || 'Untitled question'}</p>
						<p class="mt-1 text-sm whitespace-pre-wrap text-muted">
							{answerText(question, response.answers[question.id])}
						</p>
					</div>
				{/each}
			</div>

			{#if response.reason}
				<div class="rounded-lg border border-line bg-white/2 p-3">
					<p class="text-sm font-medium">Review reason</p>
					<div class="mt-1">
						<Markdown source={response.reason} compact />
					</div>
					{#if response.reviewedBy}
						<p class="mt-2 text-xs text-muted">Reviewed by {response.reviewedBy.username}</p>
					{/if}
				</div>
			{/if}

			<div class="flex flex-col gap-3">
				<p class="flex items-center gap-2 text-sm font-medium">
					<MessageSquare class="h-4 w-4" />
					Comments
				</p>

				{#each response.comments as entry (entry.id)}
					<div class="flex gap-3">
						<img
							src={avatarUrl(entry.discordID, entry.avatar)}
							alt=""
							onerror={(event) => {
								const image = event.currentTarget as HTMLImageElement;
								const fallback = defaultAvatar(entry.discordID);
								if (image.src !== fallback) image.src = fallback;
							}}
							class="h-7 w-7 shrink-0 rounded-full"
						/>
						<div class="min-w-0 flex-1">
							<p class="text-xs text-muted">{entry.username} - {stamp(entry.sentAt)}</p>
							<p class="mt-0.5 text-sm whitespace-pre-wrap">{entry.content}</p>
						</div>
					</div>
				{:else}
					<p class="text-sm text-muted">No comments on this response yet.</p>
				{/each}

				<form
					method="POST"
					action="?/comment"
					use:enhance={() => {
						working = true;

						return async ({ result }) => {
							working = false;

							if (result.type === 'failure') {
								toast(String(result.data?.message ?? 'Could not post that comment.'), 'error');
								return;
							}

							comment = '';
							toast('Comment posted.', 'success');
							onchanged();
						};
					}}
					class="flex flex-wrap items-center gap-2"
				>
					<input type="hidden" name="responseID" value={response.responseID} />

					<div class="min-w-0 flex-1">
						<input
							name="content"
							bind:value={comment}
							maxlength={messageLimit}
							placeholder="Leave a note for other reviewers"
							aria-label="New comment"
							class={shell}
						/>
					</div>

					<button
						type="submit"
						disabled={working || !comment.trim()}
						class="min-h-10 shrink-0 rounded-lg border border-line bg-white/5 px-3 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
					>
						Comment
					</button>
				</form>
			</div>

			<div class="flex flex-col gap-3 border-t border-line pt-5">
				{#if locked}
					<p class="text-sm text-muted">
						This response was {denied ? 'denied' : 'approved'}{response.reviewedBy
							? ` by ${response.reviewedBy.username}`
							: ''} and the result has already been sent, so it cannot be changed.
					</p>
				{:else}
					{#if presets.length}
						<Select
							options={presets.map((entry) => ({ value: entry.label, label: entry.label }))}
							bind:value={preset}
							placeholder="Use a saved response"
							onchange={(name) => applyPreset(name)}
						/>
					{/if}

					<textarea
						bind:value={reason}
						rows={3}
						maxlength={messageLimit}
						placeholder="Why are you approving or denying this?"
						aria-label="Review reason"
						class={shell}></textarea>
				{/if}

				<div class="flex flex-wrap gap-2">
					{#if !locked}
						<form
							method="POST"
							action="?/review"
							use:enhance={() => {
								working = true;

								return async ({ result }) => {
									working = false;

									if (result.type === 'failure') {
										toast(
											String(result.data?.message ?? 'Could not update that response.'),
											'error'
										);
										return;
									}

									toast('Response updated.', 'success');
									onchanged();
								};
							}}
							class="flex flex-wrap gap-2"
						>
							<input type="hidden" name="responseID" value={response.responseID} />
							<input type="hidden" name="reason" value={reason} />

							<label class="flex w-full items-center gap-2 text-sm text-muted">
								<Switch name="staged" bind:checked={staging} label="Stage this decision" />
								Hold this decision back until you publish the results
							</label>

							<button
								type="submit"
								name="status"
								value="approved"
								disabled={working}
								class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
							>
								{staging ? 'Stage approval' : 'Approve'}
							</button>

							<button
								type="submit"
								name="status"
								value="denied"
								disabled={working}
								class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
							>
								{staging ? 'Stage denial' : 'Deny'}
							</button>
						</form>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
