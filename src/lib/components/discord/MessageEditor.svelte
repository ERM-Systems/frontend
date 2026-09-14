<script lang="ts">
	import Braces from '@lucide/svelte/icons/braces';
	import X from '@lucide/svelte/icons/x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { fade, fly, slide } from 'svelte/transition';
	import { validateMessage, type DiscordMessage } from '$lib/discord';
	import type { MessageVariable } from '$lib/settings';
	import { toast } from '$lib/toast.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import ButtonsTab from './ButtonsTab.svelte';
	import ContainersTab from './ContainersTab.svelte';
	import EmbedsTab from './EmbedsTab.svelte';
	import ImportTab from './ImportTab.svelte';
	import MessagePreview from './MessagePreview.svelte';

	let {
		open = $bindable(false),
		message,
		title = 'Edit message',
		variables = [],
		buttonRoles = []
	}: {
		open?: boolean;
		message: DiscordMessage;
		title?: string;
		variables?: MessageVariable[];
		buttonRoles?: { value: string; label: string }[];
	} = $props();

	const tabs = [
		{ id: 'embeds', label: 'Embeds' },
		{ id: 'containers', label: 'Containers' },
		{ id: 'buttons', label: 'Buttons' },
		{ id: 'import', label: 'Discohook / JSON' },
		{ id: 'preview', label: 'Preview' }
	] as const;

	const desktop = new MediaQuery('min-width: 64rem');

	let tab = $state<(typeof tabs)[number]['id']>('embeds');
	let mounted = $state(false);
	let showVariables = $state(false);
	let field = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);
	let caret = $state(0);

	const shownTabs = $derived(
		desktop.current ? tabs.filter((entry) => entry.id !== 'preview') : tabs
	);
	const activeTab = $derived(desktop.current && tab === 'preview' ? 'embeds' : tab);
	const errors = $derived(open ? validateMessage(message) : []);
	const guild = $derived(
		page.data.guild as { id: string; name: string; iconUrl: string } | undefined
	);

	onMount(() => (mounted = true));

	function hint(variable: MessageVariable) {
		const example =
			variable.token === '{guild.icon}' ? guild?.iconUrl || variable.example : variable.example;

		return example ? `${variable.description}, e.g. ${example}` : variable.description;
	}

	function trackField(event: FocusEvent) {
		const target = event.target;
		if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
			if (target.type === 'number') return;
			field = target;
			caret = target.selectionStart ?? target.value.length;
		}
	}

	function storeCaret(event: FocusEvent) {
		if (event.target === field && field) caret = field.selectionStart ?? field.value.length;
	}

	function insertVariable(token: string) {
		if (!field || !field.isConnected) {
			toast('Click into a text field first, then pick a variable.', 'error');
			return;
		}

		const at = document.activeElement === field ? (field.selectionStart ?? caret) : caret;
		const position = Math.min(at, field.value.length);

		field.value = field.value.slice(0, position) + token + field.value.slice(position);
		field.dispatchEvent(new Event('input', { bubbles: true }));

		const next = position + token.length;
		field.focus();
		field.setSelectionRange(next, next);
		caret = next;
	}

	$effect(() => {
		if (!open) return;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (!open || event.key !== 'Escape') return;
		if (document.querySelector('[data-picker-open]')) return;
		open = false;
	}}
/>

{#if open && mounted}
	<div
		class="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm"
		role="presentation"
		onclick={() => (open = false)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed inset-0 z-100 flex items-center justify-center p-4"
		role="presentation"
		onclick={(event) => event.target === event.currentTarget && (open = false)}
	>
		<div
			class="flex h-full max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/60"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			transition:fly={{ y: 12, duration: 180 }}
			onfocusin={trackField}
			onfocusout={storeCaret}
		>
			<div class="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 lg:gap-4">
				<h2 class="min-w-0 flex-1 truncate text-base font-semibold lg:flex-none">{title}</h2>

				<div
					class="no-scrollbar order-last flex w-full shrink-0 gap-1 overflow-x-auto rounded-lg border border-line bg-bg/40 p-1 lg:order-none lg:ml-2 lg:w-auto"
				>
					{#each shownTabs as entry (entry.id)}
						<button
							type="button"
							onclick={() => (tab = entry.id)}
							aria-current={activeTab === entry.id ? 'page' : undefined}
							class="shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors pointer-coarse:py-3 {activeTab ===
							entry.id
								? 'bg-white/8 font-medium text-white'
								: 'text-muted hover:bg-white/5 hover:text-white'}"
						>
							{entry.label}
						</button>
					{/each}
				</div>

				<div class="ml-auto flex shrink-0 items-center gap-1">
					{#if variables.length}
						<button
							type="button"
							onclick={() => (showVariables = !showVariables)}
							aria-pressed={showVariables}
							class="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors {showVariables
								? 'bg-white/8 text-white'
								: 'text-muted hover:bg-white/5 hover:text-white'}"
						>
							<Braces class="h-4 w-4" />
							Variables
						</button>
					{/if}

					<button
						type="button"
						onclick={() => (open = false)}
						aria-label="Close editor"
						class="rounded-md p-2 text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:p-3.5"
					>
						<X class="h-5 w-5" />
					</button>
				</div>
			</div>

			{#if showVariables && variables.length}
				<div class="border-b border-line bg-bg/40 px-5 py-3" transition:slide={{ duration: 160 }}>
					<p class="mb-2 text-xs text-muted">
						Click a variable to drop it in wherever your cursor is.
					</p>
					<div class="flex flex-wrap gap-1.5">
						{#each variables as variable (variable.token)}
							<Tooltip text={hint(variable)}>
								<button
									type="button"
									onclick={() => insertVariable(variable.token)}
									class="rounded-md border border-line bg-white/5 px-2 py-1 font-mono text-xs text-muted transition-colors hover:bg-white/10 hover:text-white"
								>
									{variable.token}
								</button>
							</Tooltip>
						{/each}
					</div>
				</div>
			{/if}

			<div class="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_24rem]">
				<div class="min-h-0 overflow-y-auto px-5 py-5">
					{#if activeTab === 'embeds'}
						<EmbedsTab {message} />
					{:else if activeTab === 'containers'}
						<ContainersTab {message} />
					{:else if activeTab === 'buttons'}
						<ButtonsTab {message} roles={buttonRoles} />
					{:else if activeTab === 'import'}
						<ImportTab {message} />
					{:else}
						<MessagePreview {message} />
					{/if}
				</div>

				<div
					class="hidden min-h-0 overflow-y-auto border-l border-line bg-bg/30 px-5 py-5 lg:block"
				>
					<p class="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Preview</p>
					<MessagePreview {message} />
				</div>
			</div>

			<div class="flex items-center gap-4 border-t border-line px-5 py-4">
				{#if errors.length}
					<div class="flex min-w-0 items-center gap-2 text-sm text-yellow-400">
						<TriangleAlert class="h-4 w-4 shrink-0" />
						<span class="truncate"
							>{errors[0].message}{errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}</span
						>
					</div>
				{:else}
					<p class="text-sm text-muted">Looks good.</p>
				{/if}

				<button
					type="button"
					onclick={() => (open = false)}
					class="ml-auto rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}
