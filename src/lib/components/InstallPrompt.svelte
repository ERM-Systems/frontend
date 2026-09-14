<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import Plus from '@lucide/svelte/icons/plus';
	import Share from '@lucide/svelte/icons/share';
	import X from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import Modal from './Modal.svelte';
	import { needsManualInstall } from '$lib/install';

	interface InstallEvent extends Event {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	const dismissedKey = 'erm:install-dismissed';

	let deferred = $state<InstallEvent | null>(null);
	let ios = $state(false);
	let dismissed = $state(true);
	let showing = $state(false);

	const offer = $derived(!dismissed && (Boolean(deferred) || ios));

	function installed(): boolean {
		if (window.matchMedia('(display-mode: standalone)').matches) return true;
		return 'standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone);
	}

	function remember() {
		dismissed = true;
		showing = false;
		try {
			localStorage.setItem(dismissedKey, '1');
		} catch {}
	}

	async function install() {
		if (!deferred) {
			showing = true;
			return;
		}

		const event = deferred;
		deferred = null;
		await event.prompt();
		await event.userChoice;
		remember();
	}

	onMount(() => {
		if (installed()) return;

		try {
			if (localStorage.getItem(dismissedKey)) return;
		} catch {}

		dismissed = false;
		ios = needsManualInstall(
			navigator.userAgent,
			navigator.maxTouchPoints,
			'onbeforeinstallprompt' in window
		);

		const capture = (event: Event) => {
			event.preventDefault();
			deferred = event as InstallEvent;
		};

		window.addEventListener('beforeinstallprompt', capture);
		window.addEventListener('appinstalled', remember);

		return () => {
			window.removeEventListener('beforeinstallprompt', capture);
			window.removeEventListener('appinstalled', remember);
		};
	});
</script>

{#if offer}
	<section
		aria-label="Install ERM"
		transition:fly={{ y: 12, duration: 200 }}
		class="pwa-inset-bottom fixed right-4 bottom-6 left-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-2xl shadow-black/60"
	>
		<span
			aria-hidden="true"
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5"
		>
			<Download class="h-4 w-4 text-muted" />
		</span>

		<span class="min-w-0 flex-1">
			<span class="block text-sm font-medium">Install ERM</span>
			<span class="block text-sm text-muted"
				>Open it like an app, straight from your home screen.</span
			>
		</span>

		<button
			type="button"
			onclick={install}
			class="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 pointer-coarse:py-3"
		>
			Install
		</button>

		<button
			type="button"
			onclick={remember}
			aria-label="Dismiss install prompt"
			class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
		>
			<X class="h-4 w-4" />
		</button>
	</section>
{/if}

{#if showing}
	<Modal title="Add ERM to your home screen" width="max-w-md" onclose={() => (showing = false)}>
		<div class="flex flex-col gap-4 px-6 py-5">
			<p class="text-sm text-muted">
				Safari installs apps from the share menu, so this takes two taps.
			</p>

			<ol class="flex flex-col gap-3">
				<li class="flex items-center gap-3">
					<span
						aria-hidden="true"
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5"
					>
						<Share class="h-4 w-4" />
					</span>
					<span class="text-sm"
						>Tap <span class="font-medium">Share</span> in the Safari toolbar.</span
					>
				</li>

				<li class="flex items-center gap-3">
					<span
						aria-hidden="true"
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5"
					>
						<Plus class="h-4 w-4" />
					</span>
					<span class="text-sm">
						Choose <span class="font-medium">Add to Home Screen</span>, then Add.
					</span>
				</li>
			</ol>
		</div>
	</Modal>
{/if}
