<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Cloud from '@lucide/svelte/icons/cloud';
	import CloudRain from '@lucide/svelte/icons/cloud-rain';
	import CloudSnow from '@lucide/svelte/icons/cloud-snow';
	import Copy from '@lucide/svelte/icons/copy';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Moon from '@lucide/svelte/icons/moon';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Sun from '@lucide/svelte/icons/sun';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { tick, untrack } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import Callout from '$lib/components/settings/Callout.svelte';
	import Card from '$lib/components/settings/Card.svelte';
	import Field from '$lib/components/settings/Field.svelte';
	import PageHeader from '$lib/components/settings/PageHeader.svelte';
	import ChannelSelect from '$lib/components/settings/ChannelSelect.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import RaidRollback from '$lib/components/settings/RaidRollback.svelte';
	import Roles from '$lib/components/settings/Roles.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import SaveBar from '$lib/components/settings/SaveBar.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import type { ServerInformation } from '$lib/server/settings';
	import type { Weather } from '$lib/server/weather';
	import { teamNames } from '$lib/settings';
	import { editable } from '$lib/settingsForm.svelte';
	import { toast } from '$lib/toast.svelte';
	import { gameVehicles } from '$lib/vehicles';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = editable(() => data.settings);

	let linked = $state(untrack(() => data.link?.linked ?? false));
	let server = $state<ServerInformation | null | undefined>(undefined);

	$effect(() => {
		const incoming = data.server;
		let active = true;

		incoming.then((value) => active && (server = value));

		return () => {
			active = false;
		};
	});

	let linking = $state(false);
	let serverKey = $state('');
	let candidate = $state<ServerInformation | null>(null);
	let checking = $state(false);

	function closeLink() {
		linking = false;
		serverKey = '';
		candidate = null;
	}

	const shiftTypeOptions = $derived([
		{ value: 'Default', label: 'Default' },
		...data.shiftTypes
			.filter((name) => name !== 'Default')
			.map((name) => ({ value: name, label: name }))
	]);

	const missingShiftType = $derived(
		Boolean(form.value.automatic_shifts.shift_type) &&
			!shiftTypeOptions.some((option) => option.value === form.value.automatic_shifts.shift_type)
	);

	let editing = $state<number | null>(null);

	const actionOptions = [
		{ value: 'send_message', label: 'Send a message' },
		{ value: 'ping_role', label: 'Ping roles' },
		{ value: 'move_to_voice', label: 'Move caller to voice' },
		{ value: 'pm_player', label: 'PM the caller in game' },
		{ value: 'ingame_message', label: 'Message the server' },
		{ value: 'ingame_hint', label: 'Hint the server' }
	];

	const actionLabels: Record<string, string> = {
		send_message: 'Sends a message',
		ping_role: 'Pings roles',
		move_to_voice: 'Moves the caller',
		pm_player: 'PMs the caller',
		ingame_message: 'Messages the server',
		ingame_hint: 'Hints the server'
	};

	const gameActions = ['pm_player', 'ingame_message', 'ingame_hint'];

	const permissionLevels = [
		{ value: 'staff', label: 'Staff role or above' },
		{ value: 'admin', label: 'Admin role or above' },
		{ value: 'management', label: 'Management role only' },
		{ value: 'roles', label: 'Specific roles' }
	];

	const pmTargets = [
		{ value: 'caller', label: 'The player who ran it' },
		{ value: 'argument', label: 'The player they named' }
	];

	function addCommand() {
		form.value.ingame_commands.commands.push({
			trigger: '',
			action: 'send_message',
			channel: '',
			roles: [],
			message: '',
			pm_target: 'caller',
			permission: { enabled: true, level: 'staff', roles: [] },
			voice_channels: []
		});
		editing = form.value.ingame_commands.commands.length - 1;
	}

	function removeCommand(index: number) {
		form.value.ingame_commands.commands.splice(index, 1);
		editing = null;
	}

	function closeEditor() {
		const index = editing;
		editing = null;
		if (index === null) return;

		const command = form.value.ingame_commands.commands[index];
		if (command && !command.trigger.trim()) {
			form.value.ingame_commands.commands.splice(index, 1);
		}
	}

	let saving = $state(false);
	let openTeam = $state('');

	const teamIcons: Record<string, string> = {
		Police: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12c5.16-1.26 9-6.45 9-12V5z',
		Sheriff: 'm12 1l3 5h5v5l3 3l-3 3v5h-5l-3 3l-3-3H4v-5l-3-3l3-3V6h5z',
		Fire: 'M12 23a7.5 7.5 0 0 1-5.138-12.963C8.204 8.774 11.5 6.5 11 1.5c6 4 9 8 3 14c1 0 2.5 0 5-2.47c.27.773.5 1.604.5 2.47A7.5 7.5 0 0 1 12 23',
		Jail: 'M20 10V8h-4V4h-2v4h-4V4H8v4H4v2h4v4H4v2h4v4h2v-4h4v4h2v-4h4v-2h-4v-4h4zm-6 4h-4v-4h4v4z',
		DOT: 'M20 12c0-1.1-.9-2-2-2V7c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v3c-1.1 0-2 .9-2 2v5h1.33L6 19h1l.67-2h8.67l.66 2h1l.67-2H20v-5zm-4-2H8V7h8v3zm-7 5c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1z',
		Civilian:
			'M12 4a4 4 0 0 1 4 4a4 4 0 0 1-4 4a4 4 0 0 1-4-4a4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4'
	};

	let webhookUrl = $state(untrack(() => data.webhookUrl));
	let generating = $state(false);
	let regenerating = $state(false);
	let copied = $state(false);

	const status = $derived.by(() => {
		if (!data.lastEvent) return { tint: 'bg-white/25', label: 'No events received yet.' };

		const minutes = Math.floor(Date.now() / 1000 - data.lastEvent) / 60;
		if (minutes < 5) return { tint: 'bg-green-500', label: 'Receiving events.' };
		if (minutes < 30) {
			return { tint: 'bg-yellow-400', label: `Last event ${Math.floor(minutes)} minutes ago.` };
		}

		return { tint: 'bg-white/25', label: `Last event ${Math.floor(minutes / 60)} hours ago.` };
	});

	async function copyWebhook() {
		await navigator.clipboard.writeText(webhookUrl);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	let weather = $state<Weather | null>(null);
	let locationForm = $state<HTMLFormElement>();
	let validating = $state(false);
	let choices = $state<string[]>([]);
	let choosing = false;
	let validated = $state(untrack(() => data.settings.weather.location.trim()));

	$effect(() => {
		const incoming = data.weather;
		let active = true;

		incoming.then((value) => active && (weather = value));

		return () => {
			active = false;
		};
	});

	const unchecked = $derived(
		(form.value.weather.sync_time || form.value.weather.sync_weather) &&
			form.value.weather.location.trim() !== validated
	);

	async function pickPlace(place: string) {
		form.value.weather.location = place;
		await tick();

		choosing = true;
		locationForm?.requestSubmit();
	}

	const WeatherIcon = $derived.by(() => {
		if (!weather) return Cloud;
		if (weather.type === 'rain') return CloudRain;
		if (weather.type === 'snow') return CloudSnow;
		if (weather.type !== 'clear') return Cloud;
		return weather.isDay ? Sun : Moon;
	});

	function clock(value: string, withDate = false): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value || 'Unknown';

		return date.toLocaleString(undefined, {
			...(withDate ? { weekday: 'short', month: 'short', day: 'numeric' } : {}),
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	let vehicle = $state('');
	let vehicleOpen = $state(false);
	let vehicleHost = $state<HTMLElement>();

	const vehicleMatches = $derived.by(() => {
		const term = vehicle.trim().toLowerCase();
		return gameVehicles
			.filter((name) => !form.value.vehicle_restrictions.cars.includes(name))
			.filter((name) => !term || name.toLowerCase().includes(term));
	});

	function addVehicle(name = vehicle) {
		const trimmed = name.trim();
		if (!trimmed) return;

		if (!form.value.vehicle_restrictions.cars.includes(trimmed)) {
			form.value.vehicle_restrictions.cars = [...form.value.vehicle_restrictions.cars, trimmed];
		}

		vehicle = '';
		vehicleOpen = false;
	}

	function removeVehicle(name: string) {
		form.value.vehicle_restrictions.cars = form.value.vehicle_restrictions.cars.filter(
			(entry) => entry !== name
		);
	}

	const kickPunishments = [
		{ value: 'kick', label: 'Kick them' },
		{ value: 'ban', label: 'Ban them' }
	];

	let whitelistItem = $state<string | number>('');
	let blacklistItem = $state<string | number>('');

	function addItem(list: number[], entry: string | number): number[] {
		const item = Math.floor(Number(entry));
		if (!Number.isFinite(item) || item <= 0 || list.includes(item)) return list;

		return [...list, item];
	}

	function addWhitelistItem() {
		form.value.unrealistic_items_whitelist = addItem(
			form.value.unrealistic_items_whitelist,
			whitelistItem
		);
		whitelistItem = '';
	}

	function addBlacklistItem() {
		form.value.avatar_check.blacklisted_items = addItem(
			form.value.avatar_check.blacklisted_items,
			blacklistItem
		);
		blacklistItem = '';
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;
		closeLink();
		closeEditor();
		regenerating = false;
	}}
	onpointerdown={(event) => {
		if (vehicleOpen && vehicleHost && !vehicleHost.contains(event.target as Node)) {
			vehicleOpen = false;
		}
	}}
/>

<PageHeader description="Connect your ER:LC server and decide what ERM does inside it." />

<div class="mt-8 flex flex-col gap-6">
	<Card
		title="Server Connection"
		description="ERM needs your private server key to read players, logs and vehicles."
	>
		{#if linked}
			<div class="flex flex-wrap items-center gap-4 px-6 py-5">
				<div class="min-w-0 flex-1">
					{#if server === undefined}
						<div class="skeleton">
							<div class="h-4 w-40 rounded bg-white/10"></div>
							<div class="mt-2 h-3 w-56 rounded bg-white/8"></div>
						</div>
					{:else if server}
						<p class="truncate font-medium">{server.name}</p>
						<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
							<span>{server.currentPlayers}/{server.maxPlayers} players</span>
							{#if server.queue}
								<span>{server.queue} in queue</span>
							{/if}
						</div>
					{:else}
						<p class="font-medium">Server linked</p>
						<p class="mt-1 text-sm text-muted">
							ERM could not reach it just now, so it may be offline or the key may have been reset.
						</p>
					{/if}
				</div>

				<span
					class="flex items-center gap-1.5 rounded-lg border border-green-500/25 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-500 pointer-coarse:py-3"
				>
					<Check class="h-3.5 w-3.5" />
					Linked
				</span>

				<button
					type="button"
					onclick={() => (linking = true)}
					class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
				>
					Relink
				</button>
			</div>
		{:else}
			<div class="px-6 py-10 text-center">
				<div
					class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white/5"
				>
					<TriangleAlert class="h-5 w-5 text-yellow-400" />
				</div>
				<p class="mt-4 font-medium">No server linked</p>
				<p class="mx-auto mt-1 max-w-80 text-sm text-muted">
					Live player data, in-game moderation and everything below stay off until you link one.
				</p>
				<button
					type="button"
					onclick={() => (linking = true)}
					class="mt-5 rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
				>
					Link server
				</button>
			</div>
		{/if}
	</Card>

	<Card
		title="Event Webhook"
		description="Paste this URL into your private server settings in game, under Event Webhook."
	>
		<form
			id="webhook-form"
			method="POST"
			action="?/webhook"
			use:enhance={() => {
				generating = true;

				return async ({ result }) => {
					generating = false;
					regenerating = false;

					if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Could not generate a token.'), 'error');
						return;
					}

					const next = (result as { data?: { webhookUrl?: string } }).data?.webhookUrl;
					if (next) webhookUrl = next;
					toast('Webhook URL generated.', 'success');
				};
			}}
		>
			<div class="px-6 py-5">
				{#if webhookUrl}
					<div class="flex flex-wrap items-center gap-2">
						<input
							readonly
							value={webhookUrl}
							aria-label="Webhook URL"
							class="min-w-40 flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 font-mono text-xs text-muted blur-[5px] transition hover:blur-none focus:ring-0 pointer-coarse:min-h-11"
						/>

						<button
							type="button"
							onclick={copyWebhook}
							class="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
						>
							{#if copied}
								<Check class="h-4 w-4 text-green-500" />
								Copied
							{:else}
								<Copy class="h-4 w-4" />
								Copy
							{/if}
						</button>

						<button
							type="button"
							onclick={() => (regenerating = true)}
							disabled={generating}
							class="rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
						>
							{generating ? 'Generating...' : 'Regenerate URL'}
						</button>
					</div>

					<div class="mt-3 flex items-center gap-2 text-sm">
						<span class="h-2.5 w-2.5 shrink-0 rounded-full {status.tint}"></span>
						<span class="text-muted">{status.label}</span>
					</div>
				{:else}
					<p class="text-sm text-muted">
						No webhook URL yet. Generate one, then paste it into your server settings.
					</p>

					<button
						type="submit"
						disabled={generating}
						class="mt-4 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
					>
						{generating ? 'Generating...' : 'Generate URL'}
					</button>
				{/if}
			</div>
		</form>

		<Callout tone="warning">
			This URL is unique to your server and anyone with it can post events as you. Regenerating
			replaces the old one, so you will need to paste the new URL back into the game.
		</Callout>
	</Card>

	<Card
		title="In-Game Commands"
		description="Run Discord actions when a player types a ; command in your ER:LC server."
	>
		{#snippet action()}
			{#if form.value.ingame_commands.commands.length < 25}
				<button
					type="button"
					onclick={addCommand}
					class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
				>
					<Plus class="h-4 w-4" />
					Add command
				</button>
			{/if}
		{/snippet}

		<ul class="divide-y divide-line">
			{#each form.value.ingame_commands.commands as command, index (index)}
				<li>
					<button
						type="button"
						onclick={() => (editing = index)}
						class="flex w-full items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-white/5"
					>
						<span class="flex-1 truncate font-mono text-sm">
							{command.trigger ? `;${command.trigger}` : 'New command'}
						</span>

						<span class="hidden text-sm text-muted sm:block">{actionLabels[command.action]}</span>

						<Pencil class="h-4 w-4 shrink-0 text-muted" />
					</button>
				</li>
			{/each}
		</ul>

		<div
			class="px-6 py-5 {form.value.ingame_commands.commands.length ? 'border-t border-line' : ''}"
		>
			{#if form.value.ingame_commands.commands.length >= 25}
				<p class="mb-3 text-sm text-muted">You have reached the limit of 25 in-game commands.</p>
			{/if}

			<p class="text-sm text-muted">
				Needs the event webhook above. ER:LC sends every message starting with ; to it, so no other
				in-game setup is needed.
			</p>
		</div>
	</Card>

	<Card title="Logging" description="Mirror in-game events into Discord.">
		<div class="divide-y divide-line">
			<Row label="Kill logs" description="Every kill that happens in your server.">
				<ChannelSelect bind:value={form.value.kill_logs} />
			</Row>

			<Row label="Player logs" description="Players joining and leaving.">
				<ChannelSelect bind:value={form.value.player_logs} />
			</Row>

			<Row
				label="Remote commands"
				description="The channel your ER:LC server logs into. ERM reads it to mirror in-game kicks and bans, and to accept :log."
			>
				<ChannelSelect bind:value={form.value.remote_commands.webhook_channel} />
			</Row>
		</div>
	</Card>

	<Card title="Moderation" description="How ERM behaves when your staff moderate in game.">
		<div class="divide-y divide-line">
			<Row
				label="Elevation required"
				description="Only the owner and co-owners of your ER:LC server can run :admin and :unadmin through ERM."
				tight
			>
				<Switch bind:checked={form.value.elevation_required} label="Elevation required" />
			</Row>

			<Row
				label="Message on warning"
				description="Send the player a private message when warned."
				tight
			>
				<Switch bind:checked={form.value.message_on_warning} label="Message on warning" />
			</Row>

			<Row
				label="Auto-punish"
				description="Kick or ban the player in game as soon as the punishment is logged."
				tight
			>
				<Switch bind:checked={form.value.auto_punish} label="Auto-punish" />
			</Row>

			<Row label="Allow player refresh" description="Allow players to refresh themselves." tight>
				<Switch bind:checked={form.value.allow_player_refresh} label="Allow player refresh" />
			</Row>

			<Row label="RDM alerts" description="Where suspected random deathmatch is reported.">
				<ChannelSelect bind:value={form.value.rdm_channel} />
			</Row>

			<Row label="RDM mentioned roles" description="Pinged when an RDM alert fires.">
				<Roles bind:selected={form.value.rdm_mentionables} placeholder="No roles" />
			</Row>

			<Row
				label="RDM threshold"
				description="How many kills by one player it takes to trigger an alert."
			>
				<Input type="number" min={2} bind:value={form.value.rdm_threshold} suffix="kills" />
			</Row>

			<Row label="RDM window" description="The time those kills have to happen within.">
				<Input type="number" min={5} bind:value={form.value.rdm_window} suffix="seconds" />
			</Row>
		</div>
	</Card>

	<Card title="Automation" description="Things ERM does without being asked.">
		<div class="divide-y divide-line">
			<Row
				label="Automatic shifts"
				description="Start a shift when someone with in-game permissions joins, and end it when they leave. Needs their ROBLOX account linked."
				tight
			>
				<Switch bind:checked={form.value.automatic_shifts.enabled} label="Automatic shifts" />
			</Row>

			<Row label="Shift type" description="Which shift type automatic shifts use.">
				<Select
					options={shiftTypeOptions}
					bind:value={form.value.automatic_shifts.shift_type}
					placeholder="Default"
				/>
			</Row>

			<Row label="Welcome message" description="Sent to every player who joins your server.">
				<Input
					bind:value={form.value.welcome_message}
					rows={2}
					maxlength={500}
					placeholder="Welcome to our server!"
				/>
			</Row>
		</div>

		{#if missingShiftType}
			<Callout tone="warning">
				Nothing is named {form.value.automatic_shifts.shift_type} in your shift types any more, so ERM
				falls back to Default. Pick one that still exists.
			</Callout>
		{/if}
	</Card>

	<Card
		title="Kick Timer"
		description="Punish players who leave and rejoin your server too quickly."
	>
		{#snippet action()}
			<Switch bind:checked={form.value.kick_timer.enabled} label="Kick timer" />
		{/snippet}

		<div
			class="divide-y divide-line transition-opacity {form.value.kick_timer.enabled
				? ''
				: 'pointer-events-none opacity-50'}"
			inert={!form.value.kick_timer.enabled}
		>
			<Row label="Minimum time" description="How long a player has to stay before leaving is fine.">
				<Input type="number" min={60} bind:value={form.value.kick_timer.time} suffix="seconds" />
			</Row>

			<Row label="Punishment" description="What happens to a player who leaves too early.">
				<Select options={kickPunishments} bind:value={form.value.kick_timer.punishment} />
			</Row>
		</div>
	</Card>

	<Card
		title="Raid Rollback"
		description="Undo a raid by picking a point in your command history. Every reversible command up to it is undone."
	>
		<RaidRollback />

		<Callout tone="warning">
			Rolling back cannot be undone and runs one command at a time in your server, so a large
			rollback takes a while.
		</Callout>
	</Card>

	<Card
		title="Time and Weather"
		description="Match your server's time and weather to a real place."
	>
		<div class="divide-y divide-line">
			<Row label="Sync time" description="Match in-game time to a real location." tight>
				<Switch bind:checked={form.value.weather.sync_time} label="Sync time" />
			</Row>

			<Row label="Sync weather" description="Match in-game weather to a real location." tight>
				<Switch bind:checked={form.value.weather.sync_weather} label="Sync weather" />
			</Row>

			<Row label="Location" description="The real place time and weather are copied from.">
				<form
					bind:this={locationForm}
					method="POST"
					action="?/location"
					use:enhance={() => {
						const fromChoice = choosing;
						choosing = false;

						validating = true;
						weather = null;
						choices = [];

						return async ({ result }) => {
							validating = false;

							if (result.type === 'failure') {
								toast(String(result.data?.message ?? 'Could not check that location.'), 'error');
								return;
							}

							const found =
								(result as { data?: { weather?: Partial<Weather> & { matches?: string[] } } }).data
									?.weather ?? null;
							const foundMatches = found?.matches ?? [];
							validated = found ? form.value.weather.location.trim() : '';

							if (!fromChoice && foundMatches.length > 1) {
								choices = foundMatches;
								return;
							}

							weather = found as Weather | null;
							toast(`Weather found for ${found?.location ?? 'that place'}.`, 'success');
						};
					}}
					class="flex gap-2"
				>
					<input
						name="location"
						bind:value={form.value.weather.location}
						oninput={() => (choices = [])}
						maxlength={64}
						placeholder="Paris, Texas"
						class="min-w-0 flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:min-h-11"
					/>

					<button
						type="submit"
						disabled={validating || !form.value.weather.location.trim()}
						class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
					>
						{#if validating}
							<LoaderCircle class="h-4 w-4 animate-spin" />
						{/if}
						{validating ? 'Checking...' : 'Check'}
					</button>
				</form>
			</Row>
		</div>

		{#if validating}
			<div class="skeleton border-t border-line px-6 py-5" transition:slide={{ duration: 200 }}>
				<div class="flex items-center gap-4">
					<div class="h-11 w-11 shrink-0 rounded-xl bg-white/8"></div>
					<div class="min-w-0 flex-1">
						<div class="h-4 w-52 rounded bg-white/10"></div>
						<div class="mt-2 h-3 w-64 rounded bg-white/8"></div>
					</div>
				</div>
			</div>
		{:else if choices.length}
			<div class="border-t border-line px-6 py-5" transition:slide={{ duration: 200 }}>
				<p class="text-sm text-muted">
					{choices.length} places share that name. Pick the one you meant:
				</p>

				<div class="mt-3 grid gap-2 sm:grid-cols-2">
					{#each choices as place, index (place)}
						<button
							type="button"
							onclick={() => pickPlace(place)}
							in:fly={{ y: 6, duration: 180, delay: index * 25 }}
							class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/10"
						>
							<MapPin class="h-4 w-4 shrink-0 text-muted" />
							<span class="truncate">{place}</span>
						</button>
					{/each}
				</div>
			</div>
		{:else if weather}
			<div class="border-t border-line px-6 py-5" transition:slide={{ duration: 200 }}>
				<div class="flex flex-wrap items-center gap-4" in:fade={{ duration: 200, delay: 60 }}>
					<div
						class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white/5"
					>
						<WeatherIcon class="h-5 w-5 text-muted" />
					</div>

					<div class="min-w-0 flex-1">
						<p class="truncate font-medium">{weather.location}</p>
						<p class="mt-1 text-sm text-muted">
							{clock(weather.currentTime, true)} local time
						</p>
					</div>

					<div class="text-right">
						<p class="font-medium">{weather.label}</p>
						<p class="mt-1 text-sm text-muted">{weather.isDay ? 'Daytime' : 'Night'}</p>
					</div>
				</div>
			</div>
		{/if}

		<Callout tone="warning">
			Turn the weather cycle off in your ER:LC server settings, otherwise the game keeps changing it
			back and syncing fights with it.
		</Callout>
	</Card>

	<Card title="Checks" description="Catch players who break your rules before staff have to.">
		<div class="grid gap-x-10 gap-y-5 px-6 py-5 lg:grid-cols-2">
			<div class="flex flex-col gap-5">
				<h3 class="text-sm font-semibold text-muted">Avatars</h3>

				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class="text-sm font-medium">Avatar Check</p>
						<p class="mt-1 text-sm text-muted">Flag players wearing blacklisted items.</p>
					</div>

					<Switch bind:checked={form.value.avatar_check.enabled} label="Avatar Check" />
				</div>

				<Field label="Alert Channel" description="Where flagged avatars are reported.">
					<ChannelSelect bind:value={form.value.avatar_check.channel} />
				</Field>

				<Field label="Mentioned Roles" description="Pinged when an avatar is flagged.">
					<Roles bind:selected={form.value.avatar_check.mentioned_roles} placeholder="No roles" />
				</Field>

				<Field label="Message" description="Sent to the player when their avatar is flagged.">
					<Input
						bind:value={form.value.avatar_check.message}
						rows={2}
						maxlength={500}
						placeholder="Please change your avatar."
					/>
				</Field>

				<Field
					label="Allowed Items"
					description="Catalog item IDs that never get flagged, however unrealistic they look."
				>
					<div class="flex gap-2">
						<div class="min-w-0 flex-1">
							<Input type="number" min={1} bind:value={whitelistItem} placeholder="1029025" />
						</div>

						<button
							type="button"
							onclick={addWhitelistItem}
							class="rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
						>
							Add
						</button>
					</div>

					{#if form.value.unrealistic_items_whitelist.length}
						<div class="mt-3 flex flex-wrap gap-2">
							{#each form.value.unrealistic_items_whitelist as item (item)}
								<span
									class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-1.5 font-mono text-sm"
								>
									{item}
									<button
										type="button"
										onclick={() =>
											(form.value.unrealistic_items_whitelist =
												form.value.unrealistic_items_whitelist.filter((entry) => entry !== item))}
										aria-label="Remove {item}"
										class="tap text-muted transition-colors hover:text-red-400"
									>
										<X class="h-3.5 w-3.5" />
									</button>
								</span>
							{/each}
						</div>
					{/if}
				</Field>

				<Field
					label="Blocked Items"
					description="Catalog item IDs that are always flagged, on top of the built-in list."
				>
					<div class="flex gap-2">
						<div class="min-w-0 flex-1">
							<Input type="number" min={1} bind:value={blacklistItem} placeholder="1029025" />
						</div>

						<button
							type="button"
							onclick={addBlacklistItem}
							class="rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
						>
							Add
						</button>
					</div>

					{#if form.value.avatar_check.blacklisted_items.length}
						<div class="mt-3 flex flex-wrap gap-2">
							{#each form.value.avatar_check.blacklisted_items as item (item)}
								<span
									class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-1.5 font-mono text-sm"
								>
									{item}
									<button
										type="button"
										onclick={() =>
											(form.value.avatar_check.blacklisted_items =
												form.value.avatar_check.blacklisted_items.filter(
													(entry) => entry !== item
												))}
										aria-label="Remove {item}"
										class="tap text-muted transition-colors hover:text-red-400"
									>
										<X class="h-3.5 w-3.5" />
									</button>
								</span>
							{/each}
						</div>
					{/if}
				</Field>
			</div>

			<div class="flex flex-col gap-5">
				<h3 class="text-sm font-semibold text-muted">Usernames</h3>

				<Field label="Alert Channel" description="Where unrealistic usernames are reported.">
					<ChannelSelect bind:value={form.value.unrealistic_username_check.channel} />
				</Field>

				<Field label="Mentioned Roles" description="Pinged when a username is flagged.">
					<Roles
						bind:selected={form.value.unrealistic_username_check.mentioned_roles}
						placeholder="No roles"
					/>
				</Field>
			</div>
		</div>

		<Callout tone="warning">
			ERM checks avatars against its own built-in list of items, so blocked items are saved but not
			read yet. Allowed items already work.
		</Callout>
	</Card>

	<Card
		title="Vehicle restrictions"
		description="Keep whitelisted vehicles out of the wrong hands."
	>
		{#snippet action()}
			<Switch bind:checked={form.value.vehicle_restrictions.enabled} label="Vehicle restrictions" />
		{/snippet}

		<div
			class="divide-y divide-line transition-opacity {form.value.vehicle_restrictions.enabled
				? ''
				: 'pointer-events-none opacity-50'}"
			inert={!form.value.vehicle_restrictions.enabled}
		>
			<Row
				label="Allowed roles"
				description="Members with these roles can use restricted vehicles."
			>
				<Roles bind:selected={form.value.vehicle_restrictions.roles} placeholder="No roles" />
			</Row>

			<Row label="Alert Channel" description="Where restricted vehicle use is reported.">
				<ChannelSelect bind:value={form.value.vehicle_restrictions.channel} />
			</Row>

			<Row label="Warning Message" description="Sent to the player driving a restricted vehicle.">
				<Input
					bind:value={form.value.vehicle_restrictions.message}
					rows={2}
					maxlength={500}
					placeholder="That vehicle is not available to you."
				/>
			</Row>

			<Row
				label="Restricted Vehicles"
				description="Exact vehicle names as they appear in game."
				wide
			>
				<div class="flex gap-2">
					<div class="relative min-w-0 flex-1 {vehicleOpen ? 'z-50' : ''}" bind:this={vehicleHost}>
						<input
							bind:value={vehicle}
							onfocus={() => (vehicleOpen = true)}
							oninput={() => (vehicleOpen = true)}
							onkeydown={(event) => {
								if (event.key === 'Escape') {
									vehicleOpen = false;
									return;
								}
								if (event.key !== 'Enter') return;
								event.preventDefault();
								addVehicle();
							}}
							role="combobox"
							aria-expanded={vehicleOpen}
							aria-controls="vehicle-options"
							autocomplete="off"
							placeholder="2020 Falcon Interceptor"
							class="w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted focus:ring-0 pointer-coarse:min-h-11"
						/>

						{#if vehicleOpen && vehicleMatches.length}
							<ul
								id="vehicle-options"
								role="listbox"
								transition:fly={{ y: -6, duration: 150 }}
								class="absolute top-full right-0 left-0 z-60 mt-2 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-2xl shadow-black/60"
							>
								{#each vehicleMatches as name (name)}
									<li>
										<button
											type="button"
											role="option"
											aria-selected="false"
											onclick={() => addVehicle(name)}
											class="w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
										>
											{name}
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<button
						type="button"
						onclick={() => addVehicle()}
						class="rounded-lg border border-line bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 pointer-coarse:py-3"
					>
						Add
					</button>
				</div>

				{#if form.value.vehicle_restrictions.cars.length}
					<div class="mt-3 flex flex-wrap gap-2">
						{#each form.value.vehicle_restrictions.cars as car (car)}
							<span
								class="flex items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-1.5 text-sm"
							>
								{car}
								<button
									type="button"
									onclick={() => removeVehicle(car)}
									aria-label="Remove {car}"
									class="tap text-muted transition-colors hover:text-red-400"
								>
									<X class="h-3.5 w-3.5" />
								</button>
							</span>
						{/each}
					</div>
				{/if}
			</Row>
		</div>
	</Card>

	<Card title="Team Restrictions" description="Require roles before a player can join a team.">
		{#snippet action()}
			<Switch bind:checked={form.value.team_restrictions_enabled} label="Team restrictions" />
		{/snippet}

		<div
			class="transition-opacity {form.value.team_restrictions_enabled
				? ''
				: 'pointer-events-none opacity-50'}"
			inert={!form.value.team_restrictions_enabled}
		>
			<Row
				label="Minimum players"
				description="Restrictions only apply once this many players are in your server."
			>
				<Input type="number" min={0} bind:value={form.value.team_restrictions_min_players} />
			</Row>

			<ul class="divide-y divide-line border-t border-line">
				{#each teamNames as name (name)}
					{@const restriction = form.value.team_restrictions[name]}
					<li>
						<button
							type="button"
							onclick={() => (openTeam = openTeam === name ? '' : name)}
							aria-expanded={openTeam === name}
							class="flex w-full items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-white/5 {openTeam ===
							name
								? 'border-b border-line bg-white/2'
								: ''}"
						>
							<span
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5 text-muted"
							>
								<svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
									<path fill="currentColor" d={teamIcons[name] ?? teamIcons.Civilian} />
								</svg>
							</span>

							<span class="flex-1 font-medium">{name}</span>

							{#if restriction.required_roles.length}
								<span class="text-sm text-muted">
									{restriction.required_roles.length} role{restriction.required_roles.length === 1
										? ''
										: 's'}
								</span>
							{:else}
								<span class="text-sm text-muted">Open to everyone</span>
							{/if}

							<ChevronDown
								class="h-4 w-4 text-muted {openTeam === name
									? 'rotate-180'
									: ''} transition-transform"
							/>
						</button>

						{#if openTeam === name}
							<div class="px-6 pt-5 pb-5" transition:slide={{ duration: 150 }}>
								<div class="grid gap-4 sm:grid-cols-2">
									<label class="block sm:col-span-2">
										<span class="text-sm text-muted">Required roles</span>
										<div class="mt-2">
											<Roles bind:selected={restriction.required_roles} placeholder="No roles" />
										</div>
									</label>

									<label class="block">
										<span class="text-sm text-muted">Alert channel</span>
										<div class="mt-2">
											<ChannelSelect bind:value={restriction.notification_channel} />
										</div>
									</label>

									<label class="block">
										<span class="text-sm text-muted">Mentioned roles</span>
										<div class="mt-2">
											<Roles bind:selected={restriction.mentioned_roles} placeholder="No roles" />
										</div>
									</label>

									<label class="block sm:col-span-2">
										<span class="text-sm text-muted">Warning message</span>
										<div class="mt-2">
											<Input
												bind:value={restriction.warning_message}
												rows={2}
												maxlength={500}
												placeholder="You are not allowed on this team."
											/>
										</div>
									</label>

									<label class="block">
										<span class="text-sm text-muted">Kick after</span>
										<div class="mt-2">
											<Input
												type="number"
												min={0}
												bind:value={restriction.kick_after_infractions}
												suffix="warnings"
											/>
										</div>
									</label>

									<div class="flex flex-col justify-end gap-3 pb-1">
										<label class="flex cursor-pointer items-center gap-3 text-sm text-muted">
											<Switch bind:checked={restriction.warn_player} label="Warn the player" />
											Warn the player
										</label>

										<label class="flex cursor-pointer items-center gap-3 text-sm text-muted">
											<Switch
												bind:checked={restriction.load_player}
												label="Move them off the team"
											/>
											Move them off the team
										</label>
									</div>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>

		<Callout tone="warning">
			ERM does not read the master switch or the minimum player count yet, so per-team rules apply
			on their own for now.
		</Callout>
	</Card>
</div>

<SaveBar {form} blocked={unchecked} blockedLabel="Check your location before saving" />

{#if editing !== null && form.value.ingame_commands.commands[editing]}
	{@const command = form.value.ingame_commands.commands[editing]}

	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={closeEditor}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 flex max-h-[85vh] w-150 max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<div class="flex items-start gap-4 border-b border-line px-6 py-5">
			<div class="min-w-0 flex-1">
				<h2 class="truncate font-semibold">
					{command.trigger ? `;${command.trigger}` : 'New in-game command'}
				</h2>
				<p class="mt-1 text-sm text-muted">Runs when a player types this in your server chat.</p>
			</div>

			<button
				type="button"
				onclick={closeEditor}
				aria-label="Close"
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-white/5 hover:text-white"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<div class="grid gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
			<label class="block">
				<span class="text-sm text-muted">Trigger</span>
				<div class="mt-2">
					<Input bind:value={command.trigger} maxlength={32} placeholder="punish" />
				</div>
			</label>

			<label class="block">
				<span class="text-sm text-muted">Action</span>
				<div class="mt-2">
					<Select options={actionOptions} bind:value={command.action} />
				</div>
			</label>

			{#if command.action === 'move_to_voice'}
				<div class="sm:col-span-2">
					<p class="text-sm text-muted">
						Voice channels by argument, so
						<span class="font-mono">;{command.trigger || 'punish'} 2</span>
						moves the caller into whichever channel is matched to 2. Naming a player first, as in
						<span class="font-mono">;{command.trigger || 'punish'} ermsystems 1</span>, moves that
						player instead, as long as their ROBLOX account is linked and they are in a voice
						channel.
					</p>

					<div class="mt-2 flex flex-col gap-2">
						{#each command.voice_channels as target, targetIndex (targetIndex)}
							<div class="flex items-center gap-2">
								<div class="w-24 shrink-0">
									<Input bind:value={target.argument} maxlength={32} placeholder="1" />
								</div>

								<div class="min-w-0 flex-1">
									<ChannelSelect bind:value={target.channel} types={[2]} />
								</div>

								<button
									type="button"
									onclick={() => command.voice_channels.splice(targetIndex, 1)}
									aria-label="Remove voice channel"
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-white/5 hover:text-white"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						{/each}

						{#if command.voice_channels.length < 10}
							<button
								type="button"
								onclick={() => command.voice_channels.push({ argument: '', channel: '' })}
								class="flex items-center gap-2 self-start rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
							>
								<Plus class="h-4 w-4" />
								Add argument
							</button>
						{/if}
					</div>
				</div>

				<label class="block sm:col-span-2">
					<span class="text-sm text-muted">Fallback channel</span>
					<p class="mt-1 text-sm text-muted">
						Used when the argument does not match any of the above.
					</p>
					<div class="mt-2">
						<ChannelSelect bind:value={command.channel} types={[2]} />
					</div>
				</label>
			{:else if gameActions.includes(command.action)}
				{#if command.action === 'pm_player'}
					<label class="block sm:col-span-2">
						<span class="text-sm text-muted">Send the PM to</span>
						<div class="mt-2">
							<Select options={pmTargets} bind:value={command.pm_target} />
						</div>
					</label>
				{/if}

				<label class="block sm:col-span-2">
					<span class="text-sm text-muted">Message</span>
					<p class="mt-1 text-sm text-muted">
						<span class="font-mono">{'{player}'}</span> becomes the caller and
						<span class="font-mono">{'{argument}'}</span> becomes whatever they typed after the command.
					</p>
					<div class="mt-2">
						<Input
							bind:value={command.message}
							rows={2}
							maxlength={500}
							placeholder="Stay out of restricted areas."
						/>
					</div>
				</label>
			{:else}
				<label class="block">
					<span class="text-sm text-muted">Channel</span>
					<div class="mt-2">
						<ChannelSelect bind:value={command.channel} />
					</div>
				</label>

				{#if command.action === 'ping_role'}
					<label class="block">
						<span class="text-sm text-muted">Roles</span>
						<div class="mt-2">
							<Roles bind:selected={command.roles} placeholder="No roles" />
						</div>
					</label>
				{/if}

				<label class="block sm:col-span-2">
					<span class="text-sm text-muted">Message</span>
					<p class="mt-1 text-sm text-muted">
						<span class="font-mono">{'{player}'}</span> becomes the caller and
						<span class="font-mono">{'{argument}'}</span> becomes whatever they typed after the command.
					</p>
					<div class="mt-2">
						<Input
							bind:value={command.message}
							rows={2}
							maxlength={500}
							placeholder="Backup requested."
						/>
					</div>
				</label>
			{/if}
			<div class="border-t border-line pt-4 sm:col-span-2">
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class="text-sm font-medium">Permission check</p>
						<p class="mt-1 text-sm text-muted">
							Only run this for players whose linked Discord account passes the check below.
						</p>
					</div>

					<Switch bind:checked={command.permission.enabled} label="Permission check" />
				</div>

				{#if command.permission.enabled}
					<div class="mt-4 grid gap-4 sm:grid-cols-2" transition:slide={{ duration: 150 }}>
						<label class="block">
							<span class="text-sm text-muted">Required access</span>
							<div class="mt-2">
								<Select options={permissionLevels} bind:value={command.permission.level} />
							</div>
						</label>

						{#if command.permission.level === 'roles'}
							<label class="block">
								<span class="text-sm text-muted">Allowed roles</span>
								<div class="mt-2">
									<Roles bind:selected={command.permission.roles} placeholder="No roles" />
								</div>
							</label>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-2 border-t border-line px-6 py-4">
			<button
				type="button"
				onclick={() => removeCommand(editing ?? 0)}
				class="flex items-center gap-2 rounded-lg border border-red-500/25 px-3 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 pointer-coarse:py-3"
			>
				<Trash2 class="h-4 w-4" />
				Delete
			</button>

			<button
				type="button"
				onclick={closeEditor}
				class="ml-auto rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 pointer-coarse:py-3"
			>
				Done
			</button>
		</div>
	</div>
{/if}

{#if regenerating}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={() => (regenerating = false)}
		transition:fade={{ duration: 120 }}
	></div>

	<div
		class="fixed top-1/2 left-1/2 z-90 w-88 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6"
		role="dialog"
		aria-modal="true"
		transition:fly={{ y: -8, duration: 160 }}
	>
		<h2 class="text-lg font-semibold">Regenerate Webhook URL</h2>
		<p class="mt-2 text-sm text-muted">
			The current URL stops working straight away. Your server keeps sending events to it until you
			paste the new one into your private server settings.
		</p>

		<div class="mt-6 flex gap-2">
			<button
				type="button"
				onclick={() => (regenerating = false)}
				class="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
			>
				Cancel
			</button>
			<button
				type="submit"
				form="webhook-form"
				disabled={generating}
				class="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
			>
				{generating ? 'Generating...' : 'Regenerate'}
			</button>
		</div>
	</div>
{/if}

{#if linking}
	<div
		class="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
		role="presentation"
		onclick={closeLink}
		transition:fade={{ duration: 120 }}
	></div>

	<form
		method="POST"
		action={candidate ? '?/key' : '?/check'}
		class="fixed top-1/2 left-1/2 z-90 w-110 max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
		transition:fly={{ y: -8, duration: 160 }}
		use:enhance={() => {
			const confirming = !!candidate;
			if (confirming) saving = true;
			else checking = true;

			return async ({ result }) => {
				saving = false;
				checking = false;

				if (result.type === 'failure') {
					toast(String(result.data?.message ?? 'That did not work.'), 'error');
					return;
				}

				const value = (result as { data?: { server?: ServerInformation } }).data?.server ?? null;

				if (!confirming) {
					candidate = value;
					return;
				}

				linked = true;
				server = value;
				closeLink();
				toast('Server linked.', 'success');
			};
		}}
	>
		<div class="flex items-start gap-4 border-b border-line px-6 py-5">
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/8">
				<Gamepad2 class="h-5 w-5" />
			</div>

			<div class="min-w-0 flex-1">
				<h2 class="font-semibold">{candidate ? 'Is this your server?' : 'Link your server'}</h2>
				<p class="mt-1 text-sm text-muted">
					{candidate
						? 'Check the details below before linking.'
						: 'Your server key is on the ER:LC private server page, under Settings.'}
				</p>
			</div>

			<button
				type="button"
				onclick={closeLink}
				aria-label="Close"
				class="-mt-1 -mr-2 rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-white"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<div class="px-6 py-5">
			<input type="hidden" name="serverKey" value={serverKey} />

			{#if candidate}
				<div class="rounded-lg border border-line bg-bg p-4" transition:slide={{ duration: 150 }}>
					<p class="text-lg font-semibold">{candidate.name}</p>

					<div class="mt-3 flex flex-wrap gap-2 text-xs">
						<span
							class="rounded-lg border border-green-500/25 bg-green-500/10 px-2.5 py-1 font-medium text-green-500"
						>
							{candidate.currentPlayers}/{candidate.maxPlayers} players
						</span>

						{#if candidate.verification}
							<span class="rounded-lg border border-line bg-white/5 px-2.5 py-1 text-muted">
								{candidate.verification}
							</span>
						{/if}

						{#if candidate.teamBalance}
							<span class="rounded-lg border border-line bg-white/5 px-2.5 py-1 text-muted">
								Team balance on
							</span>
						{/if}
					</div>
				</div>

				<p class="mt-4 text-sm text-muted">
					If that is not the right server, go back and paste a different key.
				</p>
			{:else}
				<label class="block">
					<span class="text-sm text-muted">Server key</span>
					<input
						bind:value={serverKey}
						type="password"
						autocomplete="off"
						placeholder="Your ER:LC server key"
						class="mt-2 w-full rounded-lg border border-line bg-white/5 px-3 py-2.5 text-sm placeholder:text-muted focus:ring-0"
					/>
				</label>

				<p class="mt-3 text-sm text-muted">
					Nothing is saved yet. ERM looks the server up first so you can confirm it is the right
					one.
				</p>
			{/if}
		</div>

		<div class="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
			{#if candidate}
				<button
					type="button"
					onclick={() => (candidate = null)}
					class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
				>
					Back
				</button>
				<button
					type="submit"
					disabled={saving}
					class="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{saving ? 'Linking...' : 'Yes, link it'}
				</button>
			{:else}
				<button
					type="button"
					onclick={closeLink}
					class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white pointer-coarse:py-3"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={checking || serverKey.trim().length < 8}
					class="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:py-3"
				>
					{checking ? 'Checking...' : 'Check server'}
				</button>
			{/if}
		</div>
	</form>
{/if}
