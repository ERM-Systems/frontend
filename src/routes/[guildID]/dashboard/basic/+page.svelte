<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FileText from '@lucide/svelte/icons/file-text';
	import Globe from '@lucide/svelte/icons/globe';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import EmojiPicker from '$lib/components/settings/EmojiPicker.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import { editable } from '$lib/settingsForm.svelte';
	import {
		documentationDomains,
		documentationEmbed,
		documentationIcon,
		documentationProvider,
		prefixes,
		punishmentLevels,
		validDocumentationName,
		validDocumentationUrl,
		type DocumentationType
	} from '$lib/settings';
	import { toast } from '$lib/toast.svelte';
	import type { ResolvedPathname } from '$app/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	const prefixOptions = prefixes.map((prefix) => ({ value: prefix, label: prefix }));

	const website = $derived(`/${data.guild.id}/server` as ResolvedPathname);

	let documentation = $state<DocumentationType[] | null | undefined>(undefined);

	$effect(() => {
		const incoming = data.documentation;
		let active = true;

		incoming.then((value) => active && (documentation = value));

		return () => {
			active = false;
		};
	});

	let iconFailed = $state<string[]>([]);
	let editing = $state<DocumentationType | null>(null);
	let removing = $state<DocumentationType | null>(null);
	let docEmoji = $state('');
	let busy = $state(false);
	let nameField = $state<HTMLInputElement>();

	let supportPin = $state(untrack(() => data.supportPin));
	let revealed = $state(false);
	let generating = $state(false);

	const fullName = $derived(
		docEmoji.trim() ? `${docEmoji.trim()} ${editing?.name ?? ''}` : (editing?.name ?? '')
	);

	const editable_ = $derived(
		!!editing && validDocumentationName(fullName) && validDocumentationUrl(editing.url)
	);

	function open(entry: DocumentationType) {
		const [first] = new Intl.Segmenter().segment(entry.name);
		const lead = first?.segment ?? '';
		const emoji = lead && !/^[\p{L}\p{N}\p{P}\p{Z}]/u.test(lead) ? lead : '';

		docEmoji = emoji;
		editing = { ...entry, name: entry.name.slice(emoji.length).trimStart() };
	}

	const audiences: Record<number, string> = {
		1: 'Anyone with the staff role',
		2: 'Management-level access only',
		3: 'Administrator-level access only.'
	};

	$effect(() => {
		if (editing) nameField?.focus();
	});

	async function copyPin() {
		await navigator.clipboard.writeText(supportPin);
		toast('Support PIN copied.', 'success');
	}

	async function copyWebsite() {
		await navigator.clipboard.writeText(new URL(website, location.origin).href);
		toast('Website URL copied.', 'success');
	}

	function levelLabel(value: number): string {
		return punishmentLevels.find((level) => level.value === value)?.label ?? 'Staff';
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') {
			editing = null;
			removing = null;
		}
	}}
/>

<PageHeader description="The basic configuration settings for ERM in this server." />

<div class="mt-8 flex flex-col gap-6">
	<Card title="Roles" description="Permission levels are read top to bottom.">
		<div class="divide-y divide-line">
			<Row
				label="Staff Role"
				description="Manage their own shifts and create punishments. Safe to hand out widely."
			>
				<Roles bind:selected={form.value.staffRoles} placeholder="No staff roles" />
			</Row>

			<Row
				label="Admin Role"
				description="Moderate other staff, manage everyone's shifts, and approve leave and reduced activity requests. They can also wipe shift data."
			>
				<Roles bind:selected={form.value.adminRoles} placeholder="No admin roles" />
			</Row>

			<Row
				label="Management Role"
				description="Change anything ERM does here, including these settings."
			>
				<Roles bind:selected={form.value.managementRoles} placeholder="No management roles" />
			</Row>
		</div>

		<Callout tone="warning">
			Management is the highest level and the only one that can change these settings. Anyone you
			give it to can lock you out. Administrators can open Staff Management, Sessions and the
			punishment list, and application reviewers can open Applications. The server owner always
			counts as management, and Discord's Administrator permission counts as admin, whatever you set
			here.
		</Callout>
	</Card>

	<Card
		title="Prefix"
		description="What ERM's text commands start with. Slash commands always work."
	>
		<Row
			label="Command Prefix"
			description="Applies to every text command in this server. Only these four characters are allowed."
		>
			<Select options={prefixOptions} bind:value={form.value.prefix} mono />
		</Row>
	</Card>

	<Card title="Audit log" description="Keep a record of who changed what.">
		<Row
			label="Config Log Channel"
			description="Every change to these settings is posted here, with who made it."
		>
			<ChannelSelect bind:value={form.value.logChannel} placeholder="Not logged" />
		</Row>
	</Card>

	<Card
		title="Support PIN"
		description="Give this to ERM support so they can confirm you manage this server."
	>
		<form
			method="POST"
			action="?/supportPin"
			use:enhance={() => {
				generating = true;

				return async ({ result }) => {
					generating = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not generate a support PIN.'), 'error');
						return;
					}

					const next = (result as { data?: { supportPin?: string } }).data?.supportPin;
					if (next) supportPin = next;

					revealed = true;
					toast('Support PIN generated.', 'success');
				};
			}}
		>
			<div class="px-6 py-5">
				{#if supportPin}
					<div class="flex flex-wrap items-center gap-2">
						<span
							class="flex min-w-32 flex-1 items-center rounded-lg border border-line bg-white/5 py-2 pr-1.5 pl-3 font-mono text-sm tracking-[0.35em] pointer-coarse:py-3"
						>
							{revealed ? supportPin : '******'}
						</span>

						<button
							type="button"
							onclick={() => (revealed = !revealed)}
							class="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
						>
							{#if revealed}
								<EyeOff class="h-4 w-4" />
								Hide
							{:else}
								<Eye class="h-4 w-4" />
								Reveal
							{/if}
						</button>

						<button
							type="button"
							onclick={copyPin}
							class="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
						>
							<Copy class="h-4 w-4" />
							Copy
						</button>

						<button
							type="submit"
							disabled={generating}
							class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
						>
							<RefreshCw class="h-4 w-4 {generating ? 'animate-spin' : ''}" />
							{generating ? 'Generating...' : 'Regenerate'}
						</button>
					</div>
				{:else}
					<p class="text-sm text-muted">
						No support PIN yet. Generate one before you open a ticket with ERM support.
					</p>

					<button
						type="submit"
						disabled={generating}
						class="mt-4 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
					>
						{generating ? 'Generating...' : 'Generate PIN'}
					</button>
				{/if}
			</div>
		</form>

		<Callout tone="warning">
			Only share this with ERM support. Regenerating replaces the old PIN straight away.
		</Callout>
	</Card>

	<Card
		title="Documentation"
		description="Guides your staff can open from the panel without leaving what they were doing."
	>
		{#snippet action()}
			<button
				type="button"
				onclick={() => open({ id: '', name: '', url: '', punishmentLevel: 1 })}
				class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Plus class="h-4 w-4" />
				Add
			</button>
		{/snippet}

		{#if documentation === undefined}
			<div class="skeleton divide-y divide-line">
				{#each [0, 1] as index (index)}
					<div class="px-6 py-4">
						<div class="h-4 w-2/5 rounded bg-white/10"></div>
						<div class="mt-2 h-3 w-3/5 rounded bg-white/8"></div>
					</div>
				{/each}
			</div>
		{:else if documentation === null}
			<p class="px-6 py-5 text-sm text-muted">
				Your documentation is unavailable right now. Reload in a moment.
			</p>
		{:else if !documentation.length}
			<div class="px-6 py-10 text-center">
				<div
					class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
				>
					<BookOpen class="h-5 w-5 text-muted" />
				</div>
				<p class="mt-4 font-medium">No documentation yet</p>
				<p class="mx-auto mt-1 max-w-80 text-sm text-muted">
					Link your handbook or punishment guide so staff can check it without leaving the panel.
				</p>
				<button
					type="button"
					onclick={() => open({ id: '', name: '', url: '', punishmentLevel: 1 })}
					class="mt-5 inline-flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
				>
					<Plus class="h-4 w-4" />
					Add documentation
				</button>
			</div>
		{:else}
			<ul class="divide-y divide-line">
				{#each documentation as entry (entry.id)}
					<li class="flex flex-wrap items-center gap-4 px-6 py-4">
						<div
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5"
						>
							{#if documentationIcon(entry) && !iconFailed.includes(entry.id)}
								<img
									src={documentationIcon(entry)}
									alt=""
									loading="lazy"
									class="h-4 w-4 rounded object-cover"
									onerror={() => (iconFailed = [...iconFailed, entry.id])}
								/>
							{:else}
								<FileText class="h-4 w-4 text-muted" />
							{/if}
						</div>

						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="truncate font-medium">{entry.name}</span>
								<span
									class="rounded-full border border-line bg-white/5 px-2 py-0.5 text-[11px] text-muted"
								>
									{levelLabel(entry.punishmentLevel)}
								</span>
							</div>

							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a
								href={entry.url}
								target="_blank"
								rel="noreferrer"
								class="mt-1 flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
							>
								<span class="truncate">{entry.url}</span>
								<ExternalLink class="h-3.5 w-3.5 shrink-0" />
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</div>

						<div class="flex gap-2">
							<button
								type="button"
								onclick={() => open(entry)}
								aria-label="Edit {entry.name}"
								class="rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:px-3.5 pointer-coarse:py-3.5"
							>
								<Pencil class="h-4 w-4" />
							</button>
							<button
								type="button"
								onclick={() => (removing = entry)}
								aria-label="Delete {entry.name}"
								class="rounded-lg border border-line px-3 py-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 pointer-coarse:px-3.5 pointer-coarse:py-3.5"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card
		title="Server website"
		description="Every server with an ERLC key linked gets a live public page of its own."
	>
		<div class="flex flex-wrap items-center gap-2 px-6 py-5">
			<a
				href={website}
				class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				<Globe class="h-4 w-4" />
				Go to website
			</a>

			<button
				type="button"
				onclick={copyWebsite}
				class="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				<Copy class="h-4 w-4" />
				Copy website URL
			</button>
		</div>
	</Card>
</div>

<SaveBar {form} />

{#if editing}
	{@const entry = editing}
	{@const provider = documentationProvider(entry.url)}
	{@const embed = documentationEmbed(entry.url)}
	{@const nameOk = validDocumentationName(fullName)}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (editing = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<form
		method="POST"
		action="?/documentation"
		class="fixed top-1/2 left-1/2 z-90 w-248 max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
		transition:fly={{ y: -8, duration: 160 }}
		use:enhance={() => {
			busy = true;

			return async ({ result }) => {
				busy = false;

				if (result.type === 'failure') {
					toast(String(result.data?.message ?? 'Could not save that documentation.'), 'error');
					return;
				}

				const stored = (result as { data?: { documentation?: DocumentationType } }).data
					?.documentation;
				if (stored && documentation) {
					documentation = documentation.some((item) => item.id === stored.id)
						? documentation.map((item) => (item.id === stored.id ? stored : item))
						: [...documentation, stored];
				}

				editing = null;
				toast('Documentation saved.', 'success');
			};
		}}
	>
		<div class="flex items-start gap-4 border-b border-line px-6 py-5">
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/8">
				<BookOpen class="h-5 w-5" />
			</div>

			<div class="min-w-0 flex-1">
				<h2 class="font-semibold">
					{entry.id ? 'Edit documentation' : 'Add documentation'}
				</h2>
				<p class="mt-1 text-sm text-muted">Staff open these from the panel while they moderate.</p>
			</div>

			<button
				type="button"
				onclick={() => (editing = null)}
				aria-label="Close"
				class="-mt-1 -mr-2 rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-white"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<div class="grid md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
			<div class="max-h-[60vh] overflow-y-auto px-6 py-5">
				<input type="hidden" name="id" value={entry.id} />

				<input type="hidden" name="name" value={fullName} />

				<div class="flex gap-3">
					<div class="w-20 shrink-0 space-y-2">
						<span class="block text-sm text-muted">Emoji</span>

						<EmojiPicker bind:value={docEmoji} />
					</div>

					<label class="block min-w-0 flex-1">
						<span class="flex items-center justify-between text-sm">
							<span class="text-muted">Name</span>
							<span class="text-xs {fullName.length > 50 ? 'text-red-400' : 'text-muted'}">
								{fullName.length}/50
							</span>
						</span>

						<input
							bind:this={nameField}
							bind:value={entry.name}
							maxlength={50 - (docEmoji.trim() ? docEmoji.trim().length + 1 : 0)}
							placeholder="Staff Handbook"
							class="mt-2 w-full rounded-lg border bg-white/5 px-3 py-2.5 text-sm placeholder:text-muted focus:ring-0 {entry.name &&
							!nameOk
								? 'border-yellow-400/40 focus:border-yellow-400/60'
								: 'border-line focus:border-white/25'}"
						/>
					</label>
				</div>

				{#if entry.name && !nameOk}
					<p class="mt-2 text-xs text-yellow-400">
						{fullName.trim().length > 50
							? 'Names need to be 50 characters or fewer.'
							: 'Names need to be at least 3 characters.'}
					</p>
				{/if}

				<label class="mt-5 block">
					<span class="text-sm text-muted">Link</span>

					<div class="relative mt-2">
						<input
							bind:value={entry.url}
							name="url"
							type="url"
							placeholder="https://docs.google.com/document/..."
							class="w-full rounded-lg border bg-white/5 px-3 py-2.5 pr-10 text-sm placeholder:text-muted focus:ring-0 {entry.url &&
							!provider
								? 'border-yellow-400/40 focus:border-yellow-400/60'
								: provider
									? 'border-green-500/40 focus:border-green-500/60'
									: 'border-line focus:border-white/25'}"
						/>

						{#if provider}
							<Check class="absolute top-3 right-3 h-4 w-4 text-green-500" />
						{:else if entry.url}
							<TriangleAlert class="absolute top-3 right-3 h-4 w-4 text-yellow-400" />
						{/if}
					</div>

					{#if !provider && entry.url}
						<span class="mt-2 block text-xs text-yellow-400">
							That link will not work. Only the sites below are allowed.
						</span>
					{/if}

					<details class="group mt-2">
						<summary
							class="cursor-pointer list-none text-xs text-muted transition-colors hover:text-white"
						>
							Allowed sites
							<span class="inline-block transition-transform group-open:rotate-90">&rsaquo;</span>
						</summary>

						<div class="mt-2 flex flex-wrap gap-1.5">
							{#each documentationDomains as domain (domain)}
								<span
									class="rounded-md border border-line bg-white/5 px-2 py-0.5 font-mono text-[11px] text-muted"
								>
									{domain}
								</span>
							{/each}
						</div>

						<p class="mt-2 text-xs text-muted">
							Links must start with https, and subdomains of these count too.
						</p>
					</details>
				</label>

				<fieldset class="mt-5">
					<legend class="text-sm text-muted">Who can open it</legend>

					<div class="mt-2 grid gap-2">
						{#each punishmentLevels as level (level.value)}
							{@const active = entry.punishmentLevel === level.value}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors {active
									? 'border-white/25 bg-white/8'
									: 'border-line hover:bg-white/5'}"
							>
								<input
									type="radio"
									name="punishmentLevel"
									value={level.value}
									bind:group={entry.punishmentLevel}
									class="sr-only"
								/>

								<span
									class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border {active
										? 'border-white bg-white'
										: 'border-line'}"
								>
									{#if active}
										<span class="h-1.5 w-1.5 rounded-full bg-bg"></span>
									{/if}
								</span>

								<span class="min-w-0 flex-1">
									<span class="block text-sm font-medium">{level.label}</span>
									<span class="mt-0.5 block text-xs text-muted">{audiences[level.value]}</span>
								</span>
							</label>
						{/each}
					</div>
				</fieldset>
			</div>

			<div class="hidden max-h-[60vh] flex-col border-l border-line bg-bg md:flex">
				<div class="flex items-center gap-3 border-b border-line px-5 py-3">
					<p class="min-w-0 flex-1 truncate text-sm">
						<span class="text-muted">Preview</span>
						{#if provider}
							<span class="text-muted"> - {provider}</span>
						{/if}
					</p>

					{#if provider}
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={entry.url}
							target="_blank"
							rel="noreferrer noopener"
							class="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-white"
						>
							Open
							<ExternalLink class="h-3.5 w-3.5" />
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
				</div>

				{#if embed}
					<iframe
						src={embed}
						title="Documentation preview"
						referrerpolicy="no-referrer"
						sandbox="allow-scripts allow-same-origin allow-popups"
						class="min-h-100 w-full flex-1 bg-white"
					></iframe>
				{:else}
					<div
						class="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center"
					>
						<FileText class="h-8 w-8 text-muted" />

						{#if provider}
							<p class="text-sm font-medium">{provider}</p>
							<p class="max-w-64 text-sm text-muted">
								{provider} blocks other sites from embedding it, so it cannot be shown here. The link
								still works for your staff.
							</p>
						{:else}
							<p class="text-sm text-muted">
								{entry.url ? 'That link cannot be previewed.' : 'Paste a link to preview it here.'}
							</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
			<button
				type="button"
				onclick={() => (editing = null)}
				class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={busy || !editable_}
				class="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				{busy ? 'Saving...' : entry.id ? 'Save changes' : 'Add documentation'}
			</button>
		</div>
	</form>
{/if}

{#if removing}
	{@const entry = removing}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (removing = null)}
		transition:fade={{ duration: 120 }}
	></div>

	<form
		method="POST"
		action="?/removeDocumentation"
		class="fixed top-1/2 left-1/2 z-90 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		transition:fly={{ y: -8, duration: 160 }}
		use:enhance={() => {
			busy = true;

			return async ({ result }) => {
				busy = false;

				if (result.type === 'failure') {
					toast(String(result.data?.message ?? 'Could not delete that documentation.'), 'error');
					return;
				}

				if (documentation) documentation = documentation.filter((item) => item.id !== entry.id);

				removing = null;
				toast('Documentation deleted.', 'success');
			};
		}}
	>
		<h2 class="text-lg font-semibold">Delete documentation</h2>
		<p class="mt-2 text-sm text-muted">
			"{entry.name}" will no longer be available to your staff. This cannot be undone.
		</p>

		<input type="hidden" name="id" value={entry.id} />

		<div class="mt-6 flex gap-2">
			<button
				type="button"
				onclick={() => (removing = null)}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={busy}
				class="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				{busy ? 'Deleting...' : 'Delete'}
			</button>
		</div>
	</form>
{/if}
