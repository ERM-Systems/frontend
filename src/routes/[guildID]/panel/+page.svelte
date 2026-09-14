<script lang="ts">
	import Bell from '@lucide/svelte/icons/bell';
	import BellOff from '@lucide/svelte/icons/bell-off';
	import Car from '@lucide/svelte/icons/car';
	import Clock from '@lucide/svelte/icons/clock';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Gauge from '@lucide/svelte/icons/gauge';
	import Gavel from '@lucide/svelte/icons/gavel';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Server from '@lucide/svelte/icons/server';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import ShieldPlus from '@lucide/svelte/icons/shield-plus';
	import UserCog from '@lucide/svelte/icons/user-cog';
	import Users from '@lucide/svelte/icons/users';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import Dock from '$lib/components/panel/Dock.svelte';
	import Logs from '$lib/components/panel/Logs.svelte';
	import Menu, { type MenuItem } from '$lib/components/panel/Menu.svelte';
	import Moderations from '$lib/components/panel/Moderations.svelte';
	import OnDuty from '$lib/components/panel/OnDuty.svelte';
	import Pane from '$lib/components/panel/Pane.svelte';
	import Players from '$lib/components/panel/Players.svelte';
	import Punish from '$lib/components/panel/Punish.svelte';
	import ServerCard from '$lib/components/panel/ServerCard.svelte';
	import ShiftCard from '$lib/components/panel/ShiftCard.svelte';
	import Speech from '$lib/components/panel/Speech.svelte';
	import Vehicles from '$lib/components/panel/Vehicles.svelte';
	import {
		alertsEnabled,
		alertsSupported,
		clampLayout,
		defaults,
		disableAlerts,
		enableAlerts,
		swapPanes,
		paneIds,
		paneLabels,
		paneViewKeys,
		writeLayout,
		type Layout,
		type PaneId,
		type Views
	} from '$lib/panel';
	import { Panel, blankOptions, blankSnapshot } from '$lib/panelClient.svelte';
	import type { PunishRequest } from '$lib/speech';
	import { toast } from '$lib/toast.svelte';
	import { muteTones, playTone, tonesMuted } from '$lib/tones';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const panel = untrack(
		() => new Panel(data.guild.id, data.level, data.discordId, null, data.canBan)
	);

	let panelOptions = $state(blankOptions());

	let now = $state(Date.now());
	let layout = $state<Layout>(untrack(() => data.layout));
	let views = $state<Views>(untrack(() => data.views));
	let wide = $state(false);
	let frame = $state<HTMLElement>();
	let centre = $state<HTMLElement>();
	let side = $state<HTMLElement>();
	let dragging = $state('');
	let held = $state<PaneId | null>(null);
	let target = $state(-1);
	let moved = $state(false);
	let menu = $state<{ x: number; y: number; pane: PaneId | null } | null>(null);
	let prefill = $state<PunishRequest | null>(null);
	let floor = $state(0);

	const tabs = [
		{ id: 'duty', label: 'Staff Online', icon: Users },
		{ id: 'players', label: 'Player Panel', icon: UserCog },
		{ id: 'vehicles', label: 'Vehicles', icon: Car },
		{ id: 'punishments', label: 'Punishments', icon: Gavel }
	];

	let tab = $state('punishments');
	let quiet = $derived(tonesMuted());

	const dangerNotice = 30_000;
	const dangerCars = [
		'Strugatti Ettore 2020',
		'Surrey 650S 2016',
		'Averon R8 2017',
		'Falcon Heritage 2021',
		'Takeo Experience 2021',
		'Chevlon Corbeta 8 2023',
		'Chevlon Corbeta TZ 2014'
	];

	let watched: Set<string> | null = null;

	const tabHint = $derived.by(() => {
		if (tab === 'players') return `${panel.snapshot.server.players.length} in game`;
		if (tab === 'vehicles') return `${panel.snapshot.server.vehicles.length} spawned`;
		if (tab === 'punishments') return '';

		return `${panel.snapshot.shifts.length} on duty`;
	});

	$effect(() => {
		const { guild, level, discordId, snapshot, canBan } = data;

		void snapshot
			.catch(() => blankSnapshot())
			.then((value) => panel.sync(guild.id, level, discordId, value, canBan));
	});

	$effect(() => {
		void data.options.catch(() => blankOptions()).then((value) => (panelOptions = value));
	});

	$effect(() => {
		if (panel.focus) tab = 'punishments';
	});

	$effect(() => {
		const query = window.matchMedia('(min-width: 1024px)');
		const apply = () => (wide = query.matches);

		apply();
		query.addEventListener('change', apply);

		return () => query.removeEventListener('change', apply);
	});

	$effect(() => {
		const clock = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(clock);
	});

	$effect(() => panel.stream());

	$effect(() => {
		const spawned = panel.snapshot.server.vehicles.filter((vehicle) =>
			dangerCars.includes(vehicle.name)
		);

		if (watched) {
			for (const vehicle of spawned) {
				if (watched.has(`${vehicle.name}:${vehicle.owner}`)) continue;

				playTone('alert');
				toast(`A ${vehicle.name} has spawned, driven by ${vehicle.owner}.`, 'error', dangerNotice);
			}
		}

		watched = new Set(spawned.map((vehicle) => `${vehicle.name}:${vehicle.owner}`));
	});

	$effect(() => {
		panel.alerts = alertsEnabled();
	});

	function save(next: Layout) {
		layout = clampLayout(next);
		writeLayout(layout);
	}

	async function toggleView(id: PaneId) {
		const next = { ...views, [id]: !views[id] };
		views = next;

		const response = await fetch(panel.base, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'views.save', [paneViewKeys[id]]: next[id] })
		}).catch(() => null);

		if (!response?.ok) toast('That view preference could not be saved.', 'error');
	}

	async function toggleAlerts() {
		if (panel.alerts) {
			disableAlerts();
			panel.alerts = false;
			return;
		}

		panel.alerts = await enableAlerts();
		if (!panel.alerts) toast('Your browser is blocking desktop alerts for this site.', 'error');
	}

	function grab(edge: Edge) {
		if (!wide) return;
		dragging = edge;
	}

	const edgeSlots = { left: 0, split: 1, shelf: 3 } as const;

	type Edge = 'left' | 'right' | 'split' | 'shelf';

	function edgeValue(edge: Edge): number {
		if (edge === 'right') return layout.right;
		return layout.sizes[layout.order[edgeSlots[edge]]];
	}

	function setEdge(edge: Edge, value: number) {
		if (edge === 'right') {
			save({ ...layout, right: value });
			return;
		}

		const id = layout.order[edgeSlots[edge]];
		save({ ...layout, sizes: { ...layout.sizes, [id]: value } });
	}

	function slide(event: PointerEvent) {
		if (!dragging) return;
		event.preventDefault();

		if (dragging === 'split' || dragging === 'shelf') {
			const box = (dragging === 'split' ? centre : side)?.getBoundingClientRect();
			if (!box?.height) return;

			setEdge(dragging as Edge, ((event.clientY - box.top) / box.height) * 100);
			return;
		}

		const box = frame?.getBoundingClientRect();
		if (!box?.width) return;

		const share =
			dragging === 'left'
				? ((event.clientX - box.left) / box.width) * 100
				: ((box.right - event.clientX) / box.width) * 100;

		setEdge(dragging as Edge, share);
	}

	function nudge(edge: Edge, step: number) {
		setEdge(edge, edgeValue(edge) + step);
	}

	function lift(id: PaneId, event: DragEvent) {
		held = id;
		moved = true;

		if (!event.dataTransfer) return;

		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', id);
	}

	function allow(event: DragEvent) {
		if (!held) return;

		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
	}

	function hover(slot: number) {
		if (!held) return;

		target = slot;
	}

	function settle() {
		if (!held) return;

		if (target >= 0) save(swapPanes(layout, layout.order.indexOf(held), target));

		held = null;
		target = -1;
	}

	function cancel() {
		held = null;
		target = -1;
	}

	function shuffle(id: PaneId, step: number) {
		const from = layout.order.indexOf(id);
		moved = true;

		save(swapPanes(layout, from, (from + step + layout.order.length) % layout.order.length));
	}

	function handle(id: PaneId) {
		return {
			start: (event: DragEvent) => lift(id, event),
			step: (delta: number) => shuffle(id, delta)
		};
	}

	function open(event: MouseEvent) {
		const target = event.target as HTMLElement | null;
		if (!target?.closest('[data-panel]')) return;
		if (target.closest('input, textarea, select, [contenteditable="true"]')) return;

		event.preventDefault();

		const holder = target.closest('[data-pane]');
		menu = {
			x: event.clientX,
			y: event.clientY,
			pane: (holder?.getAttribute('data-pane') as PaneId | undefined) ?? null
		};
	}

	const options = $derived.by(() => {
		const scope = menu?.pane ?? null;

		const items: MenuItem[] = [
			{
				label: 'Reset the layout',
				icon: RotateCcw,
				action: () => save({ ...defaults, order: [...paneIds], sizes: { ...defaults.sizes } })
			},
			{
				label: quiet ? 'Unmute alert tones' : 'Mute alert tones',
				icon: quiet ? VolumeX : Volume2,
				action: () => {
					quiet = !quiet;
					muteTones(quiet);
				}
			},
			...(alertsSupported()
				? [
						{
							label: panel.alerts ? 'Turn off desktop alerts' : 'Turn on desktop alerts',
							icon: panel.alerts ? BellOff : Bell,
							action: () => void toggleAlerts()
						}
					]
				: []),
			...(scope
				? [
						{
							label: `Hide ${paneLabels[scope]}`,
							icon: Eye,
							divider: true,
							action: () => void toggleView(scope)
						}
					]
				: paneIds.map((id) => ({
						label: views[id] ? `Hide ${paneLabels[id]}` : `Show ${paneLabels[id]}`,
						icon: views[id] ? Eye : EyeOff,
						divider: id === paneIds[0],
						action: () => void toggleView(id)
					}))),
			{
				label: 'Server overview',
				icon: Gauge,
				href: resolve(`/${data.guild.id}/server`),
				divider: true
			}
		];

		if (panel.management) {
			items.push({
				label: 'Server settings',
				icon: Settings2,
				href: resolve(`/${data.guild.id}/dashboard/basic`)
			});
		}

		return items;
	});

	const baseFloor = 212;
	const maxFloor = 560;

	const serverSlot = $derived(layout.order.indexOf('server'));

	const shown = $derived(layout.order.map((id) => views[id]));

	const share = (value: number) => `--share: ${value}%`;

	const paneHeights: Record<PaneId, string> = {
		server: 'max-h-160',
		punish: '',
		logs: 'max-h-180',
		shift: 'max-h-125',
		tabs: ''
	};

	function fit(height: number) {
		floor = Math.min(maxFloor, Math.max(floor, Math.ceil(height)));
	}

	const slotClass = (slot: number) =>
		[
			'min-h-0 min-w-0 rounded-xl transition-opacity',
			held && layout.order[slot] === held ? 'opacity-40' : '',
			held && target === slot && layout.order[slot] !== held ? 'ring-2 ring-red-500/60' : ''
		].join(' ');
</script>

<svelte:head>
	<title>{data.guild.name} - Moderation Panel</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<svelte:window
	onpointermove={slide}
	onpointerup={() => (dragging = '')}
	onpointercancel={() => (dragging = '')}
	ondragend={cancel}
/>

<svelte:body oncontextmenu={open} />

{#snippet pane(id: PaneId)}
	{#if id === 'logs'}
		<Pane
			title="Logs"
			icon={ScrollText}
			hint="Live from the server"
			drag={handle('logs')}
			loading={!panel.ready}
		>
			<Logs {panel} {now} />
		</Pane>
	{:else if id === 'server'}
		<Pane
			title="Server"
			icon={Server}
			drag={handle('server')}
			grow
			onheight={fit}
			loading={!panel.ready}
		>
			{#snippet actions()}
				<div class="flex shrink-0 items-center gap-2.5">
					{#if data.guild.iconUrl}
						<img src={data.guild.iconUrl} alt="" class="h-6 w-6 shrink-0 rounded-md object-cover" />
					{/if}

					<span class="max-w-48 truncate text-sm font-semibold">{data.guild.name}</span>

					{#if panel.stale}
						<span
							class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1 text-xs font-medium text-yellow-300"
						>
							<WifiOff class="h-3.5 w-3.5" />
							Reconnecting
						</span>
					{/if}
				</div>
			{/snippet}

			<ServerCard {panel} />
		</Pane>
	{:else if id === 'punish'}
		<Pane
			title="New Moderation"
			icon={ShieldPlus}
			hint="Issue a punishment"
			drag={handle('punish')}
			loading={!panel.ready}
		>
			<Punish
				{panel}
				punishmentTypes={panelOptions.punishmentTypes}
				presets={panelOptions.presets}
				bind:prefill
			/>
		</Pane>
	{:else if id === 'tabs'}
		<Pane
			title={tabs.find((entry) => entry.id === tab)?.label ?? ''}
			hint={tabHint}
			drag={handle('tabs')}
			loading={!panel.ready}
		>
			{#snippet actions()}
				<div class="flex items-center gap-0.5">
					{#each tabs as entry (entry.id)}
						<Tooltip text={entry.label}>
							<button
								type="button"
								onclick={() => (tab = entry.id)}
								aria-label={entry.label}
								aria-pressed={tab === entry.id}
								class="rounded-lg p-1.5 transition-colors pointer-coarse:p-3.5 {tab === entry.id
									? 'bg-white/10 text-white'
									: 'text-muted hover:bg-white/5 hover:text-white'}"
							>
								<entry.icon class="h-4 w-4" />
							</button>
						</Tooltip>
					{/each}
				</div>
			{/snippet}

			{#if tab === 'duty'}
				<OnDuty {panel} {now} />
			{:else if tab === 'players'}
				<Players {panel} />
			{:else if tab === 'vehicles'}
				<Vehicles {panel} />
			{:else if tab === 'punishments'}
				<Moderations {panel} {now} punishmentTypes={panelOptions.punishmentTypes} />
			{/if}
		</Pane>
	{:else if id === 'shift'}
		<Pane
			title="My Shift"
			icon={Clock}
			hint={panel.snapshot.myShift ? 'On duty' : 'Off duty'}
			drag={handle('shift')}
			loading={!panel.ready}
		>
			<ShiftCard {panel} {now} shiftTypes={panelOptions.shiftTypes} />
		</Pane>
	{/if}
{/snippet}

<div
	data-panel
	class="flex flex-col px-4 pt-6 pb-4 lg:h-[calc(100dvh-3.5rem)]"
	class:select-none={!!dragging}
	class:no-settle={moved}
>
	<div bind:this={frame} class="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
		{#if shown[0]}
			<div
				role="group"
				data-pane={layout.order[0]}
				ondragover={allow}
				ondragenter={() => hover(0)}
				ondrop={settle}
				style={share(layout.sizes[layout.order[0]])}
				class="flex shrink-0 flex-col {paneHeights[
					layout.order[0]
				]} lg:h-full lg:max-h-none lg:w-(--share) lg:shrink {slotClass(0)}"
			>
				{@render pane(layout.order[0])}
			</div>

			<button
				type="button"
				aria-label="Resize the left column"
				onpointerdown={() => grab('left')}
				onkeydown={(event) => {
					if (event.key === 'ArrowLeft') nudge('left', -2);
					if (event.key === 'ArrowRight') nudge('left', 2);
				}}
				class="group hidden w-1.5 shrink-0 cursor-col-resize items-center justify-center rounded-full transition-colors hover:bg-white/10 lg:flex {dragging ===
				'left'
					? 'bg-red-500/60'
					: ''}"
			>
				<span class="h-10 w-0.5 rounded-full bg-line transition-colors group-hover:bg-white/30"
				></span>
			</button>
		{/if}

		{#if shown[1] || shown[2]}
			<div bind:this={centre} class="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
				{#if shown[1]}
					<div
						role="group"
						data-pane={layout.order[1]}
						ondragover={allow}
						ondragenter={() => hover(1)}
						ondrop={settle}
						style="{share(layout.sizes[layout.order[1]])}; --floor: {serverSlot === 1
							? Math.max(baseFloor, floor)
							: baseFloor}px"
						class="min-h-(--floor) shrink-0 transition-[min-height] duration-300 ease-out lg:h-(--share) lg:min-h-(--floor) {slotClass(
							1
						)}"
					>
						{@render pane(layout.order[1])}
					</div>
				{/if}

				{#if shown[1] && shown[2]}
					<button
						type="button"
						aria-label="Resize the centre panels"
						onpointerdown={() => grab('split')}
						onkeydown={(event) => {
							if (event.key === 'ArrowUp') nudge('split', -2);
							if (event.key === 'ArrowDown') nudge('split', 2);
						}}
						class="group hidden h-1.5 shrink-0 cursor-row-resize items-center justify-center rounded-full transition-colors hover:bg-white/10 lg:flex {dragging ===
						'split'
							? 'bg-red-500/60'
							: ''}"
					>
						<span class="h-0.5 w-10 rounded-full bg-line transition-colors group-hover:bg-white/30"
						></span>
					</button>
				{/if}

				{#if shown[2]}
					<div
						role="group"
						data-pane={layout.order[2]}
						ondragover={allow}
						ondragenter={() => hover(2)}
						ondrop={settle}
						class="flex shrink-0 flex-col {paneHeights[
							layout.order[2]
						]} lg:h-auto lg:max-h-none lg:min-h-64 lg:flex-1 lg:shrink {slotClass(2)}"
					>
						{@render pane(layout.order[2])}
					</div>
				{/if}
			</div>
		{/if}

		{#if shown[3] || shown[4]}
			<button
				type="button"
				aria-label="Resize the right column"
				onpointerdown={() => grab('right')}
				onkeydown={(event) => {
					if (event.key === 'ArrowLeft') nudge('right', 2);
					if (event.key === 'ArrowRight') nudge('right', -2);
				}}
				class="group hidden w-1.5 shrink-0 cursor-col-resize items-center justify-center rounded-full transition-colors hover:bg-white/10 lg:flex {dragging ===
				'right'
					? 'bg-red-500/60'
					: ''}"
			>
				<span class="h-10 w-0.5 rounded-full bg-line transition-colors group-hover:bg-white/30"
				></span>
			</button>

			<div
				bind:this={side}
				class="flex shrink-0 flex-col gap-3 lg:h-full lg:w-(--share) lg:shrink"
				style={share(layout.right)}
			>
				{#if shown[3]}
					<div
						role="group"
						data-pane={layout.order[3]}
						ondragover={allow}
						ondragenter={() => hover(3)}
						ondrop={settle}
						style={share(layout.sizes[layout.order[3]])}
						class="flex shrink-0 flex-col {paneHeights[
							layout.order[3]
						]} lg:h-(--share) lg:max-h-none lg:min-h-42 {slotClass(3)}"
					>
						{@render pane(layout.order[3])}
					</div>
				{/if}

				{#if shown[3] && shown[4]}
					<button
						type="button"
						aria-label="Resize the lower right panel"
						onpointerdown={() => grab('shelf')}
						onkeydown={(event) => {
							if (event.key === 'ArrowUp') nudge('shelf', -2);
							if (event.key === 'ArrowDown') nudge('shelf', 2);
						}}
						class="group hidden h-1.5 shrink-0 cursor-row-resize items-center justify-center rounded-full transition-colors hover:bg-white/10 lg:flex {dragging ===
						'shelf'
							? 'bg-red-500/60'
							: ''}"
					>
						<span class="h-0.5 w-10 rounded-full bg-line transition-colors group-hover:bg-white/30"
						></span>
					</button>
				{/if}

				{#if shown[4]}
					<div
						role="group"
						data-pane={layout.order[4]}
						ondragover={allow}
						ondragenter={() => hover(4)}
						ondrop={settle}
						class="flex shrink-0 flex-col {paneHeights[
							layout.order[4]
						]} lg:max-h-none lg:min-h-42 lg:flex-1 {slotClass(4)}"
					>
						{@render pane(layout.order[4])}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if menu}
	<Menu x={menu.x} y={menu.y} items={options} close={() => (menu = null)} />
{/if}

<Dock {panel} {now} documentation={panelOptions.documentation} />

<Speech
	{panel}
	punishmentTypes={panelOptions.punishmentTypes}
	shiftTypes={panelOptions.shiftTypes}
	onfill={(request) => {
		if (!views.punish) void toggleView('punish');
		prefill = request;
	}}
/>
