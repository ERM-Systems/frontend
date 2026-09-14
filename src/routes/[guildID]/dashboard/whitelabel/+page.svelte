<script lang="ts">
	import ImageOff from '@lucide/svelte/icons/image-off';
	import Lock from '@lucide/svelte/icons/lock';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import { editable } from '$lib/settingsForm.svelte';
	import { validImageUrl, whitelabelLimits } from '$lib/settings';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.whitelabel);

	let avatarError = $state('');
	let bannerError = $state('');

	const bot = $derived(data.botProfile);

	const avatarValid = $derived(validImageUrl(form.value.avatarUrl));
	const bannerValid = $derived(validImageUrl(form.value.bannerUrl));

	const verifiedBadge = $derived(!!bot?.verified);

	const avatarSrc = $derived(
		form.value.avatarUrl && avatarValid ? form.value.avatarUrl : (bot?.avatarUrl ?? '')
	);
	const bannerSrc = $derived(
		form.value.bannerUrl && bannerValid ? form.value.bannerUrl : (bot?.bannerUrl ?? '')
	);

	const avatarShown = $derived(!!avatarSrc && avatarError !== avatarSrc);
	const bannerShown = $derived(!!bannerSrc && bannerError !== bannerSrc);

	const previewName = $derived(form.value.botName || bot?.username || 'ERM');
	const initial = $derived((previewName.trim()[0] ?? 'E').toUpperCase());
</script>

<PageHeader description="Run ERM under your own bot name, avatar and banner in this server." />

<div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
	<div class="flex flex-col gap-6">
		{#if !data.active}
			<div class="rounded-xl border border-line bg-surface p-6">
				<div class="flex items-start gap-4">
					<div
						class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white/5"
					>
						<Lock class="h-5 w-5 text-muted" />
					</div>

					<div class="min-w-0">
						<h2 class="font-semibold">No whitelabel spot assigned</h2>
						<p class="mt-1 text-sm text-muted">
							This server does not have a whitelabel spot. Whoever purchased whitelabel can assign a
							spot to this server from their billing settings. Until then, ERM uses its default
							profile here.
						</p>
					</div>
				</div>
			</div>
		{:else}
			<Card title="Identity" description="How the bot introduces itself in this server.">
				<div class="divide-y divide-line">
					<Row label="Bot Name" description="Shown as the bot's display name. Up to 32 characters.">
						<Input
							bind:value={form.value.botName}
							maxlength={whitelabelLimits.botName}
							placeholder="ERM"
						/>
					</Row>

					<Row
						label="Bio"
						description="The About Me text on the bot's profile. Up to 190 characters."
						wide
					>
						<Input
							bind:value={form.value.bio}
							rows={3}
							maxlength={whitelabelLimits.bio}
							placeholder="Staff management, made simple."
						/>
					</Row>
				</div>
			</Card>

			<Card title="Imagery" description="Direct links to the images used on the bot's profile.">
				<div class="divide-y divide-line">
					<Row
						label="Avatar URL"
						description="An uploaded image or URL that'll be applied to the bot's profile picture. Recommended to be 64x64."
						wide
					>
						<Input bind:value={form.value.avatarUrl} placeholder="https://..." />
						{#if form.value.avatarUrl && !avatarValid}
							<span class="mt-2 block text-xs text-yellow-400">Use a full https:// image link.</span
							>
						{/if}
					</Row>

					<Row
						label="Banner URL"
						description="An uploaded image or URL that'll be applied to the bot's banner. Recommended to be 680x240."
						wide
					>
						<Input bind:value={form.value.bannerUrl} placeholder="https://..." />
						{#if form.value.bannerUrl && !bannerValid}
							<span class="mt-2 block text-xs text-yellow-400">Use a full https:// image link.</span
							>
						{/if}
					</Row>
				</div>

				<Callout>
					Changes to the bot's profile can take up to 15 minutes to appear in this server.
				</Callout>
			</Card>
		{/if}
	</div>

	<div class="lg:sticky lg:top-24 lg:self-start">
		<p class="mb-3 text-sm font-medium">Preview</p>

		<div class="overflow-hidden rounded-xl border border-line bg-bg">
			<div class="flex h-24 w-full items-center justify-center bg-white/5">
				{#if bannerShown}
					<img
						src={bannerSrc}
						alt=""
						class="h-full w-full object-cover"
						onerror={() => (bannerError = bannerSrc)}
					/>
				{:else}
					<ImageOff class="h-5 w-5 text-muted" />
				{/if}
			</div>

			<div class="px-4 pb-4">
				<div
					class="-mt-8 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-bg bg-surface"
				>
					{#if avatarShown}
						<img
							src={avatarSrc}
							alt=""
							class="h-full w-full object-cover"
							onerror={() => (avatarError = avatarSrc)}
						/>
					{:else}
						<span class="text-lg font-semibold text-muted">{initial}</span>
					{/if}
				</div>

				<div class="mt-3 rounded-lg bg-surface p-3">
					<div class="flex items-center gap-2">
						<span class="min-w-0 truncate font-semibold">{previewName}</span>
						<span
							class="inline-flex shrink-0 items-center gap-0.5 rounded bg-[#5865f2] px-1 py-0.5 text-[10px] leading-none font-semibold text-white"
						>
							{#if verifiedBadge}
								<svg class="h-3.5 w-3.5" viewBox="0 0 16 15.2" aria-hidden="true">
									<path fill="currentColor" d="M7.4,11.17,4,8.62,5,7.26l2,1.53L11.06,4l1.28,1Z" />
								</svg>
							{/if}
							APP
						</span>
					</div>

					{#if form.value.bio.trim()}
						<p class="mt-2 text-sm whitespace-pre-wrap text-muted">{form.value.bio}</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

{#if data.active}
	<SaveBar {form} />
{/if}
