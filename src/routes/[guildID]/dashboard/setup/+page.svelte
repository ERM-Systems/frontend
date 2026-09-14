<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CalendarOff from '@lucide/svelte/icons/calendar-off';
	import Clock from '@lucide/svelte/icons/clock';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Radio from '@lucide/svelte/icons/radio';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import PartyPopper from '@lucide/svelte/icons/party-popper';
	import { untrack } from 'svelte';
	import { fly, slide } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { dashboardHref } from '$lib/dashboard';
	import Card from '$lib/components/settings/Card.svelte';
	import Callout from '$lib/components/settings/Callout.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Duration from '$lib/components/settings/Duration.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import {
		firstUnfinished,
		nextStep,
		onboardingProgress,
		onboardingSteps,
		previousStep,
		stepDone,
		stepMeta,
		stepProblem,
		type OnboardingStep
	} from '$lib/onboarding';
	import type { ServerInformation } from '$lib/server/settings';
	import { toast } from '$lib/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let setup = $state(structuredClone(untrack(() => data.state)));
	let step = $state<OnboardingStep>(untrack(() => firstUnfinished(data.state)) ?? 'roles');
	let serverKey = $state('');
	let candidate = $state<ServerInformation | null>(null);
	let checking = $state(false);
	let saving = $state(false);
	let done = $state(untrack(() => data.state.completed));
	let heading = $state<HTMLHeadingElement>();
	let doneHeading = $state<HTMLHeadingElement>();

	$effect(() => {
		if (done) doneHeading?.focus();
	});

	const meta = $derived(stepMeta.find((entry) => entry.id === step) ?? stepMeta[0]);
	const position = $derived(onboardingSteps.indexOf(step) + 1);
	const progress = $derived(onboardingProgress(setup));
	const problem = $derived(stepProblem(setup, step));
	const back = $derived(previousStep(step));

	const pages: Record<string, string> = {
		roles: 'permissions',
		shifts: 'shift-management',
		game: 'game-integration',
		logging: 'punishments',
		requests: 'loa',
		sessions: 'sessions'
	};

	const summary = stepMeta
		.filter((entry) => entry.id !== 'welcome')
		.map((entry) => ({ ...entry, page: pages[entry.id] }));

	const tour = [
		{
			icon: Clock,
			label: 'Shifts',
			blurb: 'Staff clock on and off, and you see who actually worked.'
		},
		{
			icon: ScrollText,
			label: 'Punishments and infractions',
			blurb: 'Log warnings and bans against players, and discipline your own staff.'
		},
		{
			icon: Gamepad2,
			label: 'ER:LC integration',
			blurb: 'Read your private server live, run moderation from Discord, and log what happens.'
		},
		{
			icon: Radio,
			label: 'Sessions',
			blurb: 'Vote on a session, announce it, and lock channels while it runs.'
		},
		{
			icon: CalendarOff,
			label: 'Leave and reduced activity',
			blurb: 'Staff request time off without messaging you directly.'
		}
	];

	function focusHeading() {
		heading?.focus();
	}

	function advance() {
		const following = nextStep(step);

		if (following) {
			step = following;
			focusHeading();
			return;
		}

		done = true;
	}
</script>

<svelte:head><title>Set up ERM - {data.guild.name}</title></svelte:head>

{#if done}
	<div class="mx-auto mt-16 max-w-2xl text-center">
		<div
			class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white/5"
		>
			<PartyPopper class="h-6 w-6" aria-hidden="true" />
		</div>

		<h1 bind:this={doneHeading} tabindex="-1" class="mt-6 text-2xl font-semibold">ERM is ready</h1>
		<p class="mx-auto mt-2 max-w-lg text-muted">
			Your staff can start using it right away. Everything you skipped is still here whenever you
			want it, and nothing you set up now is permanent.
		</p>

		<div class="mt-8 grid gap-3 text-left sm:grid-cols-2">
			{#each summary as entry (entry.id)}
				<a
					href={dashboardHref(data.guild.id, entry.page)}
					class="rounded-lg border border-line bg-white/2 px-4 py-3 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
				>
					<p class="flex items-center gap-2 text-sm font-medium">
						{#if stepDone(setup, entry.id)}
							<Check class="h-4 w-4 text-green-500" aria-hidden="true" />
						{:else}
							<span class="h-1.5 w-1.5 rounded-full bg-white/25" aria-hidden="true"></span>
						{/if}
						{entry.label}
					</p>
					<p class="mt-1 text-sm text-muted">
						{stepDone(setup, entry.id) ? 'Set up, open it' : 'Not set up, open it'}
					</p>
				</a>
			{/each}
		</div>

		<form
			method="POST"
			action="?/finish"
			use:enhance={() => {
				saving = true;

				return async ({ result }) => {
					saving = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not finish setup.'), 'error');
						return;
					}

					await invalidateAll();
					window.location.href = resolve(`/${data.guild.id}/dashboard/basic`);
				};
			}}
		>
			<button
				type="submit"
				disabled={saving}
				class="mt-8 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{saving ? 'Finishing...' : 'Open the dashboard'}
			</button>
		</form>
	</div>
{:else}
	<div class="mx-auto mt-10 max-w-3xl">
		<p id="step-position" class="text-sm text-muted">
			Step {position} of {onboardingSteps.length}
		</p>

		<h1
			bind:this={heading}
			tabindex="-1"
			aria-describedby="step-position"
			class="mt-1 text-2xl font-semibold"
		>
			{meta.label}
		</h1>
		<p class="mt-2 text-muted">{meta.blurb}</p>

		<div
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={progress}
			aria-valuetext="Step {position} of {onboardingSteps.length}"
			aria-label="Setup progress"
			class="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/8"
		>
			<div class="h-full bg-white transition-all duration-300" style="width: {progress}%"></div>
		</div>

		<form
			method="POST"
			action="?/step"
			use:enhance={({ action }) => {
				const verifying = action.search === '?/check';
				if (verifying) checking = true;
				else saving = true;

				return async ({ result }) => {
					checking = false;
					saving = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not save that step.'), 'error');
						return;
					}

					if (verifying) {
						candidate = (result as { data?: { server?: ServerInformation } }).data?.server ?? null;
						return;
					}

					serverKey = '';
					candidate = null;
					await invalidateAll();
					setup = structuredClone(data.state);
					advance();
				};
			}}
			class="mt-8"
		>
			<input
				type="hidden"
				name="payload"
				value={JSON.stringify({
					step,
					state: { ...setup, game: { ...setup.game, serverKey: candidate ? serverKey : '' } }
				})}
			/>

			<button type="submit" tabindex="-1" aria-hidden="true" class="sr-only"></button>

			{#key step}
				<div in:fly={{ y: 10, duration: 200 }}>
					{#if step === 'welcome'}
						<Card title="What ERM does" description="A quick tour before you set anything.">
							<ul class="divide-y divide-line">
								{#each tour as entry, index (entry.label)}
									<li
										class="flex gap-4 px-6 py-4"
										in:fly={{ y: 8, duration: 220, delay: index * 60 }}
									>
										<div
											class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5"
										>
											<entry.icon class="h-4 w-4 text-muted" aria-hidden="true" />
										</div>

										<div class="min-w-0">
											<p class="text-sm font-medium">{entry.label}</p>
											<p class="mt-1 text-sm text-muted">{entry.blurb}</p>
										</div>
									</li>
								{/each}
							</ul>

							<Callout>
								Nothing here is permanent. Every answer is a normal setting you can change from this
								dashboard afterwards, and you can skip anything you are unsure about.
							</Callout>
						</Card>
					{:else if step === 'requests'}
						<Card
							title="Leave and reduced activity"
							description="Staff request time off, you approve it."
						>
							{#snippet action()}
								<Switch bind:checked={setup.requests.enabled} label="Leave requests" />
							{/snippet}

							<div
								class="divide-y divide-line transition-opacity {setup.requests.enabled
									? ''
									: 'pointer-events-none opacity-50'}"
								inert={!setup.requests.enabled}
							>
								<Row label="Requests channel" description="Where requests are sent for approval.">
									<ChannelSelect bind:value={setup.requests.channel} label="Requests channel" />
								</Row>

								<Row label="On leave role" description="Given while someone's leave is active.">
									<Roles
										bind:selected={setup.requests.loaRoles}
										placeholder="No role"
										label="On leave role"
									/>
								</Row>
							</div>
						</Card>
					{:else if step === 'sessions'}
						<Card title="Sessions" description="Vote, start and shutdown messages all post here.">
							<Row label="Sessions channel" description="Where session messages are posted.">
								<ChannelSelect
									bind:value={setup.sessions.channel}
									placeholder="No channel"
									label="Sessions channel"
								/>
							</Row>

							<Callout>
								The messages themselves come with templates, so you can run a session straight away
								and rewrite them later in the Sessions page.
							</Callout>
						</Card>
					{:else if step === 'roles'}
						<Card title="Roles" description="You can change any of these later in Permissions.">
							<div class="divide-y divide-line">
								<Row
									label="Management"
									description="Full control, and the only people who can open this dashboard."
								>
									<Roles
										bind:selected={setup.roles.managementRoles}
										placeholder="No roles yet"
										label="Management roles"
									/>
								</Row>

								<Row
									label="Staff"
									description="Your general team. Shifts, punishments, the basics."
								>
									<Roles
										bind:selected={setup.roles.staffRoles}
										placeholder="No roles yet"
										label="Staff roles"
									/>
								</Row>

								<Row
									label="Admin"
									description="Optional middle tier. Moderates other staff and approves leave."
								>
									<Roles
										bind:selected={setup.roles.adminRoles}
										placeholder="No roles yet"
										label="Admin roles"
									/>
								</Row>
							</div>

							<Callout tone="warning">
								Anyone with a management role can change everything, including who has management.
								Your server owner always counts as management.
							</Callout>
						</Card>
					{:else if step === 'shifts'}
						<Card title="Shifts" description="Staff clock on and off, and you see who did what.">
							{#snippet action()}
								<Switch bind:checked={setup.shifts.enabled} label="Shifts" />
							{/snippet}

							<div
								class="divide-y divide-line transition-opacity {setup.shifts.enabled
									? ''
									: 'pointer-events-none opacity-50'}"
								inert={!setup.shifts.enabled}
							>
								<Row label="Shift channel" description="Where clock ons and clock offs are posted.">
									<ChannelSelect bind:value={setup.shifts.channel} label="Shift channel" />
								</Row>

								<Row
									label="Weekly quota"
									description="How long each staff member should be on duty."
								>
									<Duration
										bind:seconds={setup.shifts.quota}
										units={['hours', 'minutes']}
										label="Weekly quota"
									/>
								</Row>
							</div>
						</Card>
					{:else if step === 'game'}
						<Card title="ER:LC server" description="Paste the server key from your private server.">
							{#if setup.game.linked}
								<div class="px-6 py-5">
									<p class="flex items-center gap-2 text-sm">
										<Check class="h-4 w-4 text-green-500" aria-hidden="true" />
										Your server is already linked.
									</p>
								</div>
							{:else if candidate}
								<div class="px-6 py-5" transition:slide={{ duration: 160 }}>
									<p class="text-sm text-muted">Is this your server?</p>

									<div class="mt-3 rounded-lg border border-line bg-bg p-4">
										<p class="text-lg font-semibold">{candidate.name}</p>

										<div class="mt-3 flex flex-wrap gap-2 text-xs">
											<span
												class="rounded-lg border border-green-500/25 bg-green-500/10 px-2.5 py-1 font-medium text-green-500"
											>
												{candidate.currentPlayers}/{candidate.maxPlayers} players
											</span>

											{#if candidate.verification}
												<span
													class="rounded-lg border border-line bg-white/5 px-2.5 py-1 text-muted"
												>
													{candidate.verification}
												</span>
											{/if}

											{#if candidate.teamBalance}
												<span
													class="rounded-lg border border-line bg-white/5 px-2.5 py-1 text-muted"
												>
													Team balance on
												</span>
											{/if}
										</div>
									</div>

									<button
										type="button"
										onclick={() => (candidate = null)}
										class="mt-4 text-sm font-semibold text-muted transition-colors hover:text-white"
									>
										Use a different key
									</button>
								</div>
							{:else}
								<input type="hidden" name="serverKey" value={serverKey} />

								<Row
									label="Server key"
									description="Private server settings in game, under Server Key."
									wide
								>
									<div class="flex flex-wrap gap-3">
										<div class="min-w-40 flex-1">
											<Input
												bind:value={serverKey}
												type="password"
												label="Server key"
												placeholder="Paste your key"
											/>
										</div>

										<button
											type="submit"
											formaction="?/check"
											disabled={checking || serverKey.trim().length < 8}
											class="shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:py-3"
										>
											{checking ? 'Checking...' : 'Check server'}
										</button>
									</div>
								</Row>

								<Callout>
									Nothing is saved until you check the key and confirm the server. Without this, ERM
									still handles shifts and staff.
								</Callout>
							{/if}
						</Card>
					{:else}
						<Card title="Logging" description="Both are optional, and easy to change later.">
							<div class="divide-y divide-line">
								<Row label="Punishments" description="Where punishments your staff log are posted.">
									<ChannelSelect
										bind:value={setup.logging.punishments}
										placeholder="Not logged"
										label="Punishments channel"
									/>
								</Row>

								<Row label="ERM activity" description="Setting changes and other ERM actions.">
									<ChannelSelect
										bind:value={setup.logging.ermLog}
										placeholder="Not logged"
										label="ERM activity channel"
									/>
								</Row>
							</div>
						</Card>
					{/if}
				</div>
			{/key}

			<div class="mt-6 flex flex-wrap items-center gap-3">
				{#if back}
					<button
						type="button"
						onclick={() => {
							step = back;
							focusHeading();
						}}
						class="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 pointer-coarse:py-3"
					>
						<ArrowLeft class="h-4 w-4" aria-hidden="true" />
						Back
					</button>
				{/if}

				<div class="ml-auto flex flex-wrap items-center gap-3">
					{#if meta.optional}
						<button
							type="submit"
							formaction="?/skip"
							class="rounded-lg px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 pointer-coarse:py-3"
						>
							Skip for now
						</button>
					{/if}

					<button
						type="submit"
						disabled={saving}
						aria-describedby={problem ? 'step-problem' : undefined}
						onclick={(event) => {
							if (!problem) return;

							event.preventDefault();
							document.getElementById('step-problem')?.focus();
						}}
						class="flex items-center gap-2 rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
					>
						{saving ? 'Saving...' : candidate ? 'Yes, link it' : 'Save and continue'}
						<ArrowRight class="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
			</div>

			<p
				id="step-problem"
				tabindex="-1"
				aria-live="polite"
				class="mt-3 text-sm text-muted focus:outline-none"
			>
				{problem}
			</p>
		</form>
	</div>
{/if}
