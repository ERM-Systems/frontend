<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import ImageUp from '@lucide/svelte/icons/image-up';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import ColorPicker from '$lib/components/settings/ColorPicker.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { resolve } from '$app/paths';
	import { dashboardHref } from '$lib/dashboard';
	import {
		accents,
		linkLabelLimit,
		linkLimit,
		panelNames,
		taglineLimit,
		validUrl
	} from '$lib/serverOverview';
	import { editable } from '$lib/settingsForm.svelte';
	import { toast } from '$lib/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	let copied = $state(false);

	const bannerBroken = $derived(!!form.value.banner.trim() && !validUrl(form.value.banner.trim()));

	let uploading = $state(false);
	let picker = $state<HTMLInputElement>();

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

			form.value.banner = payload.url;
			toast('Banner uploaded, save to publish it.', 'success');
		} catch {
			toast('That upload did not go through.', 'error');
		} finally {
			uploading = false;
		}
	}

	function addLink() {
		form.value.links.push({ label: '', url: '' });
	}

	function removeLink(position: number) {
		form.value.links.splice(position, 1);
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(data.publicUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast('Could not copy that link.', 'error');
		}
	}
</script>

<PageHeader description="The public page anyone can open to see your server's live status." />

<div class="mt-8 grid items-start gap-6 lg:grid-cols-2">
	<div class="flex flex-col gap-6">
		<Card title="Public Page" description="Turn the overview on and share it with your community.">
			<Row
				label="Overview Page"
				description="When this is off the page returns a 404 for everyone."
				tight
			>
				<Switch bind:checked={form.value.enabled} label="Overview page" />
			</Row>

			<Row label="Link" description="Anyone with this link can see the page." wide>
				<div class="flex gap-2">
					<input
						readonly
						value={data.publicUrl}
						aria-label="Public overview link"
						class="min-h-10 w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm pointer-coarse:min-h-11"
					/>

					<button
						type="button"
						onclick={copy}
						aria-label="Copy link"
						class="flex shrink-0 items-center rounded-lg border border-line bg-white/5 px-3 text-muted transition-colors hover:bg-white/10 hover:text-white pointer-coarse:px-3.5"
					>
						{#if copied}
							<Check class="h-4 w-4 text-green-400" />
						{:else}
							<Copy class="h-4 w-4" />
						{/if}
					</button>

					<a
						href={resolve('/[guildID]/server', { guildID: data.guild.id })}
						target="_blank"
						rel="noreferrer noopener"
						aria-label="Open the overview"
						class="flex shrink-0 items-center rounded-lg border border-line bg-white/5 px-3 text-muted transition-colors hover:bg-white/10 hover:text-white pointer-coarse:px-3.5"
					>
						<ExternalLink class="h-4 w-4" />
					</a>
				</div>
			</Row>
		</Card>

		<Card title="Presentation" description="How the page introduces your server.">
			<div class="grid gap-5 px-6 py-5">
				<Field
					label="Tagline"
					description="Shown under your server name. Leave this empty to use your Discord description."
					counter="{form.value.tagline.length}/{taglineLimit}"
				>
					<Input
						bind:value={form.value.tagline}
						maxlength={taglineLimit}
						rows={3}
						placeholder="A short line about your community"
					/>
				</Field>

				<Field
					label="Banner"
					description="Upload an image or paste an https link. Leave this empty to use your Discord banner."
				>
					<div class="flex gap-2">
						<div class="min-w-0 flex-1">
							<Input bind:value={form.value.banner} placeholder="https://example.com/banner.png" />
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

						<input
							bind:this={picker}
							type="file"
							accept="image/*"
							onchange={upload}
							class="hidden"
							aria-label="Upload a banner"
						/>
					</div>

					{#if bannerBroken}
						<p class="mt-2 text-sm text-yellow-400">
							That is not a valid https link, so the Discord banner is used instead.
						</p>
					{:else if form.value.banner.trim()}
						<img
							src={form.value.banner.trim()}
							alt=""
							class="mt-3 h-28 w-full rounded-lg border border-line object-cover"
						/>
					{/if}
				</Field>
			</div>

			<Row label="Accent" description="Tints the header, buttons and progress bars." tight>
				<ColorPicker bind:value={form.value.accent} presets={accents} label="Accent" />
			</Row>
		</Card>
	</div>

	<div class="flex flex-col gap-6">
		<Card
			title="Panels"
			description="Pick what the page shows. Anything off is never sent to visitors."
		>
			<Row label="Join Button" description="Show a button that opens your server in ER:LC." tight>
				<Switch bind:checked={form.value.join_button} label="Join button" />
			</Row>

			{#each panelNames as panel (panel.key)}
				<Row label={panel.label} description={panel.description} tight>
					<Switch bind:checked={form.value.panels[panel.key]} label={panel.label} />
				</Row>
			{/each}

			<Callout>
				Some data are live from your linked ER:LC server. If you don't see any data, make sure your
				server has a key set in <a
					href={dashboardHref(data.guild.id, 'game-integration')}
					class="underline underline-offset-2 hover:text-white">Game Integration</a
				>.
			</Callout>
		</Card>

		<Card title="Links" description="Extra links shown in the header, next to the join button.">
			{#snippet action()}
				<button
					type="button"
					onclick={addLink}
					disabled={form.value.links.length >= linkLimit}
					class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					<Plus class="h-4 w-4" />
					Add
				</button>
			{/snippet}

			{#if form.value.links.length}
				<div class="grid gap-4 px-6 py-5">
					{#each form.value.links as link, position (position)}
						<div class="flex flex-wrap items-start gap-2 sm:flex-nowrap">
							<div class="w-full sm:w-44">
								<Input bind:value={link.label} maxlength={linkLabelLimit} placeholder="Our rules" />
							</div>

							<div class="min-w-0 flex-1">
								<Input bind:value={link.url} placeholder="https://example.com/rules" />
								{#if link.url.trim() && !validUrl(link.url.trim())}
									<p class="mt-2 text-sm text-yellow-400">
										Links need an https address, so this one is dropped when you save.
									</p>
								{/if}
							</div>

							<button
								type="button"
								onclick={() => removeLink(position)}
								aria-label="Remove link"
								class="flex min-h-10 shrink-0 items-center rounded-lg border border-line bg-white/5 px-3 text-muted transition-colors hover:bg-white/10 hover:text-white"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="px-6 py-5 text-sm text-muted">
					No extra buttons yet. Add up to {linkLimit} links to your rules, application form or anywhere
					else.
				</p>
			{/if}
		</Card>
	</div>
</div>

<SaveBar {form} />
