<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Link2Off from '@lucide/svelte/icons/link-2-off';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import ActivityGraph from '$lib/components/ActivityGraph.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { navbar, setNavbar } from '$lib/navbar.svelte';
	import { setTheme, theme, themes } from '$lib/theme.svelte';
	import { modLabel, shortcuts } from '$lib/shortcuts';
	import { defaultAvatar } from '$lib/staff';
	import { toast } from '$lib/toast.svelte';
	import type { DailyActivity, Stats } from '$lib/stats';
	import type { Preferences } from '$lib/server/user';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let preferences = $state(untrack(() => ({ ...data.preferences }) as Preferences));
	let refreshing = $state(false);
	let saving = $state(false);
	let unlinking = $state(false);
	let linking = $state(false);
	let asText = $state(false);
	let selected = $state('');
	let stats = $state<Stats | null | undefined>(undefined);

	const placeholder: Record<string, DailyActivity> = Object.fromEntries(
		Array.from({ length: 365 }, (_, offset) => [
			new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10),
			{ moderations: (offset * 7919) % 13, shifts: 0, seconds: 0 }
		])
	);
	let period = $state<number | null>(null);
	let menu = $state(false);
	let picker = $state<HTMLElement>();

	$effect(() => {
		const incoming = data.stats;
		let active = true;

		incoming.then((value) => {
			if (active && period === null) stats = value;
		});

		return () => {
			active = false;
		};
	});

	const years = $derived.by(() => {
		const earliest = stats?.earliest;
		if (!earliest) return [];

		const first = new Date(earliest * 1000).getUTCFullYear();
		const now = new Date().getUTCFullYear();

		return Array.from({ length: now - first + 1 }, (_, offset) => now - offset);
	});

	async function pick(next: number | null) {
		period = next;
		stats = undefined;
		selected = '';

		const response = await fetch(`/api/stats${next === null ? '' : `?year=${next}`}`).catch(
			() => null
		);

		if (!response?.ok) {
			stats = null;
			toast('Could not load that period, try again.', 'error');
			return;
		}

		stats = await response.json();
	}

	const untouched: (keyof typeof preferences)[] = [
		'ModView',
		'ShiftView',
		'StaffView',
		'ERLCView',
		'LogView',
		'AIPredictions',
		'CompactMode'
	];

	const automation: { key: keyof typeof preferences; label: string; description: string }[] = [
		{
			key: 'AutomaticShifts',
			label: 'Automatic shifts',
			description: 'Start your shift when you join an ER:LC server as staff.'
		},
		{
			key: 'ShiftReports',
			label: 'Shift reports',
			description: 'Get a DM summarising your shift when you go off duty.'
		},
		{
			key: 'Punishments',
			label: 'Punishment notices',
			description: 'Get a DM whenever you are moderated.'
		}
	];

	function duration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		if (!hours && !minutes) return '0m';
		return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
	}

	function months(daily: Record<string, DailyActivity>, year: number | null) {
		const now = new Date();

		return Array.from({ length: 12 }, (_, offset) => {
			const date =
				year === null
					? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
					: new Date(Date.UTC(year, 11 - offset, 1));
			const key = date.toISOString().slice(0, 7);

			const days = Object.entries(daily).filter(([day]) => day.startsWith(key));
			const total = (pick: (activity: DailyActivity) => number) =>
				days.reduce((sum, [, activity]) => sum + pick(activity), 0);

			return {
				key,
				label: date.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
				moderations: total((activity) => activity.moderations),
				shifts: total((activity) => activity.shifts),
				seconds: total((activity) => activity.seconds),
				days: days.filter(([, activity]) => activity.moderations || activity.shifts).length
			};
		});
	}

	function link() {
		const url = new URL('https://verify.ermbot.xyz/login');
		url.searchParams.set('state', data.profile.discordId);
		url.searchParams.set('panel', 'true');
		if (data.staging) url.searchParams.set('staging', 'true');
		if (data.affiliates) url.searchParams.set('affiliates', 'true');

		const popup = window.open(url, 'roblox-link', 'width=600,height=700');
		if (!popup) {
			toast('Allow popups to link your ROBLOX account.', 'error');
			return;
		}

		linking = true;
		const timer = setInterval(async () => {
			if (!popup.closed) return;

			clearInterval(timer);
			linking = false;
			await invalidateAll();
		}, 1000);
	}
</script>

<svelte:window
	onkeydown={(event) => event.key === 'Escape' && (menu = false)}
	onpointerdown={(event) => {
		if (menu && picker && !picker.contains(event.target as Node)) menu = false;
	}}
/>

<svelte:head><title>Settings - ERM Systems</title></svelte:head>

<section class="mx-auto max-w-350 px-6 py-16">
	<h1 class="text-4xl font-bold tracking-[-0.03em]">Settings</h1>
	<p class="mt-3 text-muted">Your accounts, your activity, and how ERM works for you.</p>

	<div
		class="mt-10 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]"
	>
		<div class="flex min-w-0 flex-col gap-6">
			<div class="rounded-xl border border-line bg-surface p-6">
				<h2 class="text-sm tracking-wide text-muted uppercase">Discord</h2>

				<div class="mt-4 flex items-center gap-4">
					<img
						src={data.profile.avatarUrl}
						alt=""
						onerror={(event) => {
							const image = event.currentTarget as HTMLImageElement;
							const fallback = defaultAvatar(data.profile.discordId);
							if (image.src !== fallback) image.src = fallback;
						}}
						class="h-14 w-14 rounded-full"
					/>
					<div class="min-w-0">
						<p class="truncate font-semibold">{data.profile.username}</p>
						<p class="mt-1 text-sm text-muted">{data.profile.discordId}</p>
					</div>
				</div>

				<form
					method="POST"
					action="?/refresh"
					use:enhance={() => {
						refreshing = true;

						return async ({ result }) => {
							refreshing = false;

							if (result.type === 'failure') {
								toast(String(result.data?.message ?? 'Could not refresh your profile.'), 'error');
								return;
							}

							await invalidateAll();
							toast('Profile refreshed from Discord.', 'success');
						};
					}}
				>
					<button
						type="submit"
						disabled={refreshing}
						class="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
					>
						<RefreshCw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" />
						Refresh profile
					</button>
				</form>
			</div>

			<div class="rounded-xl border border-line bg-surface p-6">
				<h2 class="text-sm tracking-wide text-muted uppercase">ROBLOX</h2>

				{#await data.roblox}
					<div class="skeleton mt-4 flex items-center gap-4">
						<div class="h-14 w-14 rounded-lg bg-white/8"></div>
						<div class="flex-1">
							<div class="h-4 w-3/5 rounded bg-white/10"></div>
							<div class="mt-2 h-3 w-2/5 rounded bg-white/8"></div>
						</div>
					</div>
				{:then roblox}
					{#if roblox}
						<div class="mt-4 flex items-center gap-4">
							{#if roblox.thumbnailUrl}
								<img src={roblox.thumbnailUrl} alt="" class="h-14 w-14 rounded-lg bg-white/5" />
							{/if}
							<div class="min-w-0">
								<p class="truncate font-semibold">{roblox.username}</p>
								<p class="mt-1 text-sm text-muted">{roblox.id}</p>
							</div>
						</div>
					{:else}
						<div class="mt-4 flex items-start gap-3">
							<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
							<p class="text-sm text-muted">
								No ROBLOX account is linked. You will not be able to use in-game features like
								automatic shifts or issue punishments in-game without linking your account.
							</p>
						</div>
					{/if}

					<div class="mt-5 flex gap-2">
						<button
							type="button"
							onclick={link}
							disabled={linking}
							class="flex-1 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
						>
							{#if linking}
								Waiting for ROBLOX...
							{:else}
								{roblox ? 'Relink account' : 'Link account'}
							{/if}
						</button>

						{#if roblox}
							<form
								method="POST"
								action="?/unlink"
								class="flex"
								use:enhance={() => {
									unlinking = true;

									return async ({ result }) => {
										unlinking = false;

										if (result.type === 'failure') {
											toast(String(result.data?.message ?? 'Could not unlink.'), 'error');
											return;
										}

										await invalidateAll();
										toast('ROBLOX account unlinked.', 'success');
									};
								}}
							>
								<button
									type="submit"
									disabled={unlinking}
									aria-label="Unlink ROBLOX account"
									class="flex items-center justify-center rounded-lg border border-line px-3 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:min-w-11"
								>
									<Link2Off class="h-4 w-4" />
								</button>
							</form>
						{/if}
					</div>
				{/await}
			</div>

			<div class="rounded-xl border border-line bg-surface pointer-coarse:hidden">
				<div class="border-b border-line px-6 py-5">
					<h2 class="font-semibold">Keyboard shortcuts</h2>
					<p class="mt-1 text-sm text-muted">
						Press {modLabel} K anywhere to jump between pages.
					</p>
				</div>

				<ul class="divide-y divide-line">
					{#each shortcuts as shortcut (shortcut.label)}
						<li class="flex items-center gap-4 px-6 py-3.5">
							<span class="flex-1 text-sm">{shortcut.label}</span>
							<span class="flex gap-1">
								{#each shortcut.keys as key (key)}
									<kbd class="rounded border border-line bg-white/5 px-2 py-1 text-xs">{key}</kbd>
								{/each}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<div class="flex min-w-0 flex-col gap-6">
			<form
				method="POST"
				action="?/preferences"
				use:enhance={() => {
					saving = true;

					return async ({ result }) => {
						saving = false;

						if (result.type === 'failure') {
							toast(String(result.data?.message ?? 'Could not save your preferences.'), 'error');
							return;
						}

						const saved = (result as { data?: { preferences?: Preferences } }).data?.preferences;
						if (saved) preferences = { ...saved };

						toast('Preferences saved.', 'success');
					};
				}}
			>
				{#each untouched as key (key)}
					<input type="hidden" name={key} value={preferences[key] ? 'on' : ''} />
				{/each}

				<div class="rounded-xl border border-line bg-surface">
					<div class="flex flex-wrap items-center gap-4 border-b border-line px-6 py-5">
						<div class="flex-1">
							<h2 class="font-semibold">Automation</h2>
							<p class="mt-1 text-sm text-muted">How ERM works with you outside the dashboard.</p>
						</div>

						<button
							type="submit"
							disabled={saving || !data.preferences}
							class="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
						>
							{saving ? 'Saving...' : 'Save'}
						</button>
					</div>

					{#if !data.preferences}
						<p class="px-6 py-5 text-sm text-muted">
							Your preferences could not be loaded, so they cannot be changed right now. Reload in a
							moment.
						</p>
					{/if}

					<div
						class="divide-y divide-line {data.preferences ? '' : 'pointer-events-none opacity-40'}"
					>
						{#each automation as option (option.key)}
							<label class="flex cursor-pointer items-center gap-4 px-6 py-4">
								<span class="flex-1">
									<span class="block font-medium">{option.label}</span>
									<span class="mt-1 block text-sm text-muted">{option.description}</span>
								</span>
								<Switch name={option.key} bind:checked={preferences[option.key]} />
							</label>
						{/each}
					</div>
				</div>
			</form>

			<div class="rounded-xl border border-line bg-surface">
				<div class="flex flex-wrap items-center gap-3 border-b border-line px-6 py-5">
					<div class="flex-1">
						<h2 class="font-semibold">Moderation activity</h2>
						<p class="mt-1 text-sm text-muted">
							{period === null
								? 'Your logged moderations from the past year.'
								: `Your ${period} moderation statistics.`}
						</p>
					</div>

					<div class="relative" bind:this={picker}>
						<button
							type="button"
							onclick={() => (menu = !menu)}
							aria-haspopup="menu"
							aria-expanded={menu}
							class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm transition-colors hover:bg-white/10 pointer-coarse:py-3"
						>
							{period === null ? 'Past year' : period}
							<ChevronDown
								class="h-4 w-4 text-muted {menu ? 'rotate-180' : ''} transition-transform"
							/>
						</button>

						{#if menu}
							<div
								class="absolute top-full right-0 z-50 mt-2 max-h-[min(16rem,60dvh)] w-40 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-2xl shadow-black/60"
								role="menu"
								transition:fly={{ y: -6, duration: 150 }}
							>
								{#each [null, ...years] as option (option ?? 'recent')}
									<button
										type="button"
										role="menuitem"
										onclick={() => {
											menu = false;
											if (option !== period) pick(option);
										}}
										class="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors {option ===
										period
											? 'bg-white/8 text-white'
											: 'text-muted hover:bg-white/5'}"
									>
										{option === null ? 'Past year' : option}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<label class="flex cursor-pointer items-center gap-3 text-sm text-muted">
						Advanced View
						<Switch bind:checked={asText} label="Advanced View" />
					</label>
				</div>

				<div class="grid grid-cols-[minmax(0,1fr)] px-6 py-5">
					{#key stats === undefined}
						<div
							class="min-w-0 [grid-area:1/1]"
							in:fade={{ duration: 200, delay: 150 }}
							out:fade={{ duration: 150 }}
						>
							{#if stats === undefined}
								<div class="skeleton" aria-hidden="true">
									<ActivityGraph daily={placeholder} year={period} />
								</div>
							{:else}
								{#if !stats}
									<p class="text-sm text-muted">
										Your activity is unavailable right now. Try again in a moment.
									</p>
								{:else if asText}
									{@const list = months(stats.daily, period)}
									{@const active = list.find((month) => month.key === selected) ?? list[0]}
									<div class="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
										<ul class="max-h-72 space-y-1 overflow-y-auto pr-1">
											{#each list as month (month.key)}
												<li>
													<button
														type="button"
														onclick={() => (selected = month.key)}
														class="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors {month.key ===
														active.key
															? 'bg-white/8 text-white'
															: 'text-muted hover:bg-white/5'}"
													>
														{month.label}
													</button>
												</li>
											{/each}
										</ul>

										<div class="rounded-lg border border-line p-5">
											<h3 class="font-semibold">{active.label}</h3>

											<dl class="mt-4 grid grid-cols-2 gap-4 text-sm">
												<div>
													<dt class="text-muted">Punishments</dt>
													<dd class="mt-1 text-lg font-semibold">{active.moderations}</dd>
												</div>
												<div>
													<dt class="text-muted">Shifts</dt>
													<dd class="mt-1 text-lg font-semibold">{active.shifts}</dd>
												</div>
												<div>
													<dt class="text-muted">On duty</dt>
													<dd class="mt-1 text-lg font-semibold">{duration(active.seconds)}</dd>
												</div>
												<div>
													<dt class="text-muted">Active days</dt>
													<dd class="mt-1 text-lg font-semibold">{active.days}</dd>
												</div>
											</dl>

											{#if !active.moderations && !active.shifts}
												<p class="mt-4 text-sm text-muted">Nothing logged this month.</p>
											{/if}
										</div>
									</div>
								{:else}
									<ActivityGraph daily={stats.daily} year={period} />
								{/if}

								{#if stats}
									<dl class="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-5 text-center">
										<div>
											<dt class="text-xs text-muted">Punishments</dt>
											<dd class="mt-1 text-lg font-semibold">{stats.moderations}</dd>
										</div>
										<div>
											<dt class="text-xs text-muted">Shifts</dt>
											<dd class="mt-1 text-lg font-semibold">{stats.shifts}</dd>
										</div>
										<div>
											<dt class="text-xs text-muted">On duty</dt>
											<dd class="mt-1 text-lg font-semibold">{duration(stats.onDutySeconds)}</dd>
										</div>
									</dl>
								{/if}
							{/if}
						</div>
					{/key}
				</div>
			</div>

			<div class="rounded-xl border border-line bg-surface">
				<div class="border-b border-line px-6 py-5">
					<h2 class="font-semibold">Appearance</h2>
					<p class="mt-1 text-sm text-muted">How ERM looks on this device.</p>
				</div>

				<fieldset class="border-b border-line px-6 py-5">
					<legend class="sr-only">Theme</legend>

					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
						{#each themes as entry (entry.id)}
							{@const chosen = theme.id === entry.id}
							<label
								class="flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-white/40 {chosen
									? 'border-white/45 bg-white/6'
									: 'border-line hover:border-white/15 hover:bg-white/3'}"
							>
								<input
									type="radio"
									name="theme"
									value={entry.id}
									checked={chosen}
									onchange={() => setTheme(entry.id)}
									class="sr-only"
								/>

								<span
									aria-hidden="true"
									class="flex h-8 w-8 shrink-0 flex-col overflow-hidden rounded-lg border border-line"
									style="background: {entry.swatch.bg}"
								>
									<span class="mt-auto h-3 w-full" style="background: {entry.swatch.surface}"
									></span>
								</span>

								<span class="min-w-0 flex-1 truncate text-sm font-medium">{entry.name}</span>

								{#if chosen}
									<Check class="h-4 w-4 shrink-0" />
								{/if}
							</label>
						{/each}
					</div>
				</fieldset>

				<label class="flex cursor-pointer items-center gap-4 px-6 py-4">
					<span class="flex-1">
						<span class="block font-medium">Floating navbar</span>
						<span class="mt-1 block text-sm text-muted">
							Lift the navbar off the top of the page instead of attaching it.
						</span>
					</span>
					<Switch bind:checked={navbar.floating} label="Floating navbar" onchange={setNavbar} />
				</label>
			</div>
		</div>
	</div>
</section>
