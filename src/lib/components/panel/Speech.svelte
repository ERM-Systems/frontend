<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Copy from '@lucide/svelte/icons/copy';
	import List from '@lucide/svelte/icons/list';
	import Mic from '@lucide/svelte/icons/mic';
	import MicOff from '@lucide/svelte/icons/mic-off';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { type Panel } from '$lib/panelClient.svelte';
	import {
		bestMatch,
		chooseType,
		commandFloors,
		commandInfo,
		createRecogniser,
		extractCommand,
		langOptions,
		matchAnswer,
		matchCommand,
		speechSupported,
		storeDevice,
		storedDevice,
		storeDiagnostics,
		storedDiagnostics,
		storeLang,
		listOf,
		spokenCount,
		spokenDuration,
		storedLang,
		storeListening,
		storedListening,
		wakeGap,
		wakeWord,
		type Alternative,
		type Command,
		type CommandName,
		type InfoTopic,
		type PunishRequest,
		type Recogniser,
		type RecogniserEvent
	} from '$lib/speech';
	import { toast } from '$lib/toast.svelte';
	import { toneAudio, tonesMuted } from '$lib/tones';
	import { indexNames, matchNames, type SeenName } from '$lib/usernames';

	let {
		panel,
		punishmentTypes,
		shiftTypes,
		onfill
	}: {
		panel: Panel;
		punishmentTypes: string[];
		shiftTypes: string[];
		onfill: (request: PunishRequest) => void;
	} = $props();

	const errorLimit = 3;
	const restartDelay = 500;
	const restartCeiling = 8000;
	const idleDelay = 50;
	const settleDelay = 600;
	const logLimit = 15;

	interface Heard {
		at: string;
		final: boolean;
		matched: boolean;
		gap: number;
		command: string;
		alternatives: Alternative[];
	}

	const topics: InfoTopic[] = ['stats', 'staff', 'time', 'priorities', 'requests', 'shift'];

	const confirmWindow = 15000;

	let open = $state(false);
	let pinned = $state(false);
	let popover = $state('');
	let listening = $state(false);
	let remembered = $state(false);
	let stage = $state<'' | 'awake' | 'working'>('');
	let supported = $state(false);
	let sinkSupported = $state(false);
	let transcript = $state('');
	let step = $state('');
	let picking = $state(false);
	let voiced = $state(false);
	let settling = $state(false);
	let type = $state('');
	let player = $state('');
	let reason = $state('');
	let highlight = $state(-1);
	let info = $state<InfoTopic | ''>('');
	let pending = $state<{ name: CommandName; text: string } | null>(null);
	let asked = $state(0);
	let mic = $state('');
	let speaker = $state('');
	let mics = $state<{ value: string; label: string }[]>([]);
	let speakers = $state<{ value: string; label: string }[]>([]);
	let lang = $state('en-US');
	let langs = $state<{ value: string; label: string }[]>([]);
	let diagnostics = $state(false);
	let engine = $state<'idle' | 'starting' | 'running' | 'stopped'>('idle');
	let restarts = $state(0);
	let failures = $state(0);
	let lastError = $state('');
	let results = $state<Heard[]>([]);
	let host = $state<HTMLElement>();
	let field = $state<HTMLInputElement>();

	let recognition: Recogniser | null = null;
	let stream: MediaStream | null = null;
	let restart: ReturnType<typeof setTimeout> | null = null;
	let expiry: ReturnType<typeof setTimeout> | null = null;
	let starting = false;
	let gone = false;
	let wokeAt = -1;

	onMount(() => {
		supported = speechSupported();
		sinkSupported = 'setSinkId' in HTMLMediaElement.prototype;
		mic = storedDevice('mic');
		speaker = storedDevice('speaker');
		lang = storedLang();
		langs = langOptions();
		diagnostics = storedDiagnostics();
		remembered = storedListening();

		if (supported && remembered) void restore();
	});

	$effect(() => () => {
		gone = true;
		hush();
		release();
		forget();
	});

	$effect(() => {
		if (step) field?.focus();
	});

	$effect(() => {
		if (!listening || engine === 'running') {
			settling = false;
			return;
		}

		const timer = setTimeout(() => (settling = true), settleDelay);
		return () => clearTimeout(timer);
	});

	const presets = $derived(punishmentTypes.slice(0, 4));

	const shiftOptions = $derived(shiftTypes.length ? shiftTypes : ['Default']);

	const mine = $derived(panel.snapshot.myShift);

	const rows = $derived([
		...topics.map((topic) => ({
			key: topic,
			phrase: commandInfo[topic].phrase,
			active: info === topic,
			run: () => ask(topic)
		})),
		{
			key: 'startShift',
			phrase: commandInfo.startShift.phrase,
			active: false,
			run: () => manage('startShift', '')
		},
		{
			key: 'endShift',
			phrase: commandInfo.endShift.phrase,
			active: false,
			run: () => manage('endShift', '')
		},
		{
			key: 'breakShift',
			phrase: mine?.onBreak ? 'end my break' : commandInfo.breakShift.phrase,
			active: false,
			run: () => manage('breakShift', '')
		},
		...presets.map((preset) => ({
			key: `type:${preset}`,
			phrase: `${preset.toLowerCase()} a user`,
			active: false,
			run: () => start(preset)
		})),
		{
			key: 'moderate',
			phrase: commandInfo.moderate.phrase,
			active: false,
			run: () => start('')
		}
	]);

	const known = $derived.by(() => {
		const now = Math.floor(Date.now() / 1000);
		const entries: SeenName[] = panel.snapshot.server.players.map((entry) => ({
			name: entry.name,
			id: entry.id,
			at: now
		}));

		for (const entry of panel.snapshot.moderations) {
			entries.push({ name: entry.username, id: entry.userId, at: entry.epoch });
		}

		for (const entry of panel.snapshot.logs) {
			if (entry.kind !== 'joins' || !entry.actorId) continue;
			entries.push({ name: entry.actor, id: entry.actorId, at: entry.timestamp });
		}

		return indexNames(entries);
	});

	const roster = $derived(known.map((entry) => entry.name));

	const suggestions = $derived(step === 'player' ? matchNames(player, known) : []);

	const flow = $derived(picking ? ['type', 'player', 'reason'] : ['player', 'reason']);

	const stepIndex = $derived(flow.indexOf(step));

	const typeOptions = $derived(punishmentTypes.map((entry) => ({ value: entry, label: entry })));

	const micState = $derived(
		!supported
			? 'unsupported'
			: !listening
				? remembered
					? 'paused'
					: 'off'
				: engine === 'running' || !settling
					? 'live'
					: 'starting'
	);

	const status = $derived(
		stage === 'awake' ? 'Listening...' : stage === 'working' ? 'Working...' : ''
	);

	const micLabel = $derived(
		micState === 'unsupported'
			? 'This browser has no speech recognition'
			: micState === 'off'
				? 'Microphone off'
				: micState === 'paused'
					? 'Paused, click the microphone to resume'
					: micState === 'starting'
						? 'Starting the microphone'
						: `Waiting for "${wakeWord}"...`
	);

	const report = $derived.by(() => {
		const lines = [
			`state ${engine}, restarts ${restarts}, failures ${failures}`,
			`lang ${lang}, last error ${lastError || 'none'}`
		];

		for (const entry of results) {
			lines.push(
				`${entry.at} ${entry.final ? 'final' : 'interim'} ${entry.matched ? 'matched' : `no match, closest ${Number.isFinite(entry.gap) ? entry.gap : '-'}`}, ${entry.command}`
			);

			for (const alternative of entry.alternatives) {
				lines.push(`  ${alternative.confidence.toFixed(2)} ${alternative.transcript || '(empty)'}`);
			}
		}

		return lines.join('\n');
	});

	const reply = $derived.by(() => {
		if (!info) return '';

		const at = asked;
		const { server, shifts, priorities, requests, myShift } = panel.snapshot;

		if (info === 'stats') {
			if (server.status === 'unconfigured' || server.status === 'unavailable') {
				return "I can't reach the server right now.";
			}

			if (server.status === 'offline') return 'The server is offline at the moment.';
			if (!server.currentPlayers) return 'Nobody is in the server right now.';

			const staff = server.players.filter((entry) => entry.permission !== 'Normal').length;
			const count =
				server.currentPlayers === 1
					? 'There is 1 player'
					: `There are ${server.currentPlayers} players`;
			const extra = [
				server.queue ? `${server.queue} waiting in the queue` : '',
				staff ? `${spokenCount(staff, 'staff member')} in game` : '',
				server.vehicles.length ? `${spokenCount(server.vehicles.length, 'vehicle')} spawned` : ''
			].filter(Boolean);

			return extra.length
				? `${count} in the server, with ${listOf(extra)}.`
				: `${count} in the server.`;
		}

		if (info === 'staff') {
			if (!shifts.length) return 'Nobody is on duty right now.';

			const lead =
				shifts.length === 1 ? 'One person is on duty' : `${shifts.length} people are on duty`;
			const resting = shifts.filter((shift) => shift.onBreak);
			const note_ = resting.length
				? ` ${listOf(resting.map((shift) => shift.name))} ${resting.length === 1 ? 'is' : 'are'} on break.`
				: '';

			return `${lead}: ${listOf(shifts.map((shift) => shift.name))}.${note_}`;
		}

		if (info === 'time') {
			const clock = new Date(at).toLocaleString(undefined, {
				weekday: 'long',
				hour: 'numeric',
				minute: '2-digit'
			});
			return `It's ${clock}.`;
		}

		if (info === 'priorities') {
			if (!priorities.length) return 'There are no open priority requests.';

			const lead =
				priorities.length === 1
					? 'There is 1 open priority request'
					: `There are ${priorities.length} open priority requests`;

			return `${lead}: ${listOf(priorities.map((entry) => entry.reason))}.`;
		}

		if (info === 'requests') {
			if (!requests.length) return 'There are no staff requests right now.';
			if (!panel.openRequests) {
				return `Nothing is waiting, all ${spokenCount(requests.length, 'staff request')} have been acknowledged.`;
			}

			return `${panel.openRequests} of ${spokenCount(requests.length, 'staff request')} still ${panel.openRequests === 1 ? 'needs' : 'need'} acknowledging.`;
		}

		if (!myShift) return "You're not on shift right now.";

		const since = spokenDuration(Math.floor(at / 1000) - myShift.startEpoch);
		const logged = myShift.moderations
			? `, with ${spokenCount(myShift.moderations, 'moderation')} logged`
			: '';

		return `You've been ${myShift.onBreak ? 'on break' : 'on duty'} for ${since} as ${myShift.type}${logged}.`;
	});

	function closeStream() {
		for (const track of stream?.getTracks() ?? []) track.stop();
		stream = null;
	}

	function cue() {
		if (tonesMuted()) return;

		const audio = toneAudio('alert');
		if (!audio) return;

		audio.volume = 0.4;
		audio.currentTime = 0;

		if (speaker && sinkSupported) {
			void audio
				.setSinkId(speaker)
				.then(() => audio.play())
				.catch(() => null);
			return;
		}

		void audio.play().catch(() => null);
	}

	async function loadDevices() {
		const found = await navigator.mediaDevices.enumerateDevices().catch(() => []);

		mics = [
			{ value: '', label: 'System default' },
			...found
				.filter((device) => device.kind === 'audioinput')
				.map((device, position) => ({
					value: device.deviceId,
					label: device.label || `Microphone ${position + 1}`
				}))
		];

		speakers = [
			{ value: '', label: 'System default' },
			...found
				.filter((device) => device.kind === 'audiooutput')
				.map((device, position) => ({
					value: device.deviceId,
					label: device.label || `Speaker ${position + 1}`
				}))
		];
	}

	async function capture(): Promise<boolean> {
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: mic ? { deviceId: { exact: mic } } : true
			});
		} catch {
			return false;
		}

		return true;
	}

	function hush() {
		if (!('speechSynthesis' in window)) return;

		window.speechSynthesis.cancel();
	}

	function speak(text: string): boolean {
		if (!('speechSynthesis' in window) || tonesMuted()) return false;

		window.speechSynthesis.cancel();

		const utterance = new SpeechSynthesisUtterance(text);
		const settle = () => {
			if (stage === 'working') stage = '';
		};

		utterance.onend = settle;
		utterance.onerror = settle;
		window.speechSynthesis.speak(utterance);

		return true;
	}

	function announce(text: string) {
		toast(text);
		if (!speak(text)) stage = '';
	}

	function note(final: boolean, alternatives: Alternative[], matched: boolean, command: string) {
		const entry: Heard = {
			at: new Date().toLocaleTimeString(),
			final,
			matched,
			gap: Math.min(...alternatives.map((option) => wakeGap(option.transcript))),
			command,
			alternatives
		};

		results = [entry, ...results].slice(0, logLimit);
	}

	function pick(texts: string[]): { name: CommandName; text: string; score: number } | null {
		let best: { name: CommandName; text: string; score: number } | null = null;

		for (const text of texts) {
			const match = matchCommand(text);
			if (!match || (best && match.score <= best.score)) continue;

			best = { name: match.name, text, score: match.score };
		}

		return best;
	}

	function accepts(score: number): boolean {
		return score >= commandFloors.accept;
	}

	function outline(texts: string[] | null): string {
		if (pending) return `answering ${pending.name}`;

		const chosen = texts ? pick(texts) : null;
		if (!chosen) return 'no command';

		return `${chosen.name} ${chosen.score} ${accepts(chosen.score) ? 'accepted' : 'confirming'}`;
	}

	function hear(event: RecogniserEvent) {
		failures = 0;

		const at = event.results.length - 1;
		const result = event.results[at];
		if (!result) return;

		const heard: Alternative[] = [];
		for (let index = 0; index < result.length; index += 1) {
			heard.push({
				transcript: result[index].transcript.trim(),
				confidence: result[index].confidence
			});
		}

		const woken = heard
			.map((option) => extractCommand(option.transcript))
			.filter((value) => value !== null);

		const bodies = woken.length
			? woken
			: stage === 'awake' && at !== wokeAt
				? heard.map((option) => option.transcript)
				: null;

		if (diagnostics) note(result.isFinal, heard, woken.length > 0, outline(bodies));

		if (!bodies) {
			transcript = '';
			return;
		}

		if (woken.length && at !== wokeAt) {
			wokeAt = at;
			stage = 'awake';
			cue();
		}

		transcript = bodies[0] ?? '';
		if (!result.isFinal) return;

		transcript = '';
		if (!bodies.some(Boolean)) return;

		stage = 'working';
		review(bodies);
	}

	function fail(error: string): boolean {
		if (error === 'no-speech' || error === 'aborted') return false;

		failures += 1;

		if (error !== 'not-allowed' && error !== 'service-not-allowed' && failures < errorLimit) {
			return true;
		}

		disable();
		toast('Voice commands stopped listening. Turn the microphone back on to retry.', 'error');

		return true;
	}

	function schedule(delay: number) {
		if (restart) clearTimeout(restart);
		restart = null;

		if (!listening || document.hidden) return;

		restarts += 1;
		restart = setTimeout(begin, delay);
	}

	function backoff(): number {
		return Math.min(restartCeiling, restartDelay * 2 ** failures);
	}

	function begin() {
		if (!listening || recognition || starting || document.hidden) return;

		const recogniser = createRecogniser();
		if (!recogniser) return;

		let failed = false;

		recogniser.lang = lang;
		recogniser.continuous = true;
		recogniser.interimResults = true;
		recogniser.maxAlternatives = 5;

		recogniser.onresult = (event) => {
			if (recogniser === recognition) hear(event);
		};

		recogniser.onerror = (event) => {
			if (recogniser !== recognition) return;

			lastError = event.message ? `${event.error}: ${event.message}` : event.error;
			failed = fail(event.error);
		};

		recogniser.onstart = () => {
			if (recogniser === recognition) engine = 'running';
		};

		recogniser.onend = () => {
			if (recogniser !== recognition) return;

			recognition = null;
			engine = 'stopped';
			schedule(failed ? backoff() : idleDelay);
		};

		starting = true;
		engine = 'starting';

		try {
			recogniser.start();
		} catch {
			starting = false;
			engine = 'stopped';
			failures += 1;
			schedule(backoff());
			return;
		}

		starting = false;
		recognition = recogniser;
	}

	function release() {
		if (restart) clearTimeout(restart);
		restart = null;

		const recogniser = recognition;
		recognition = null;
		recogniser?.abort();
		engine = 'stopped';
		transcript = '';
		closeStream();
	}

	async function enable() {
		if (!supported || listening) return;

		if (!(await capture())) {
			toast('Microphone access is blocked for this site.', 'error');
			return;
		}

		if (gone) {
			closeStream();
			return;
		}

		listening = true;
		remembered = true;
		stage = '';
		wokeAt = -1;
		failures = 0;
		restarts = 0;
		lastError = '';
		results = [];
		storeListening(true);
		begin();
		void loadDevices();
	}

	async function restore() {
		try {
			const granted = await navigator.permissions.query({ name: 'microphone' as PermissionName });
			if (granted.state !== 'granted') return;
		} catch {
			return;
		}

		if (gone) return;

		await enable();
	}

	function disable() {
		listening = false;
		remembered = false;
		stage = '';
		wokeAt = -1;
		storeListening(false);
		forget();
		hush();
		release();
		engine = 'idle';
	}

	async function resume() {
		if (!listening || stream || !(await capture())) return;

		begin();
	}

	function relisten() {
		if (!listening) return;

		release();
		void resume();
	}

	async function copyReport() {
		try {
			await navigator.clipboard.writeText(report);
			toast('Diagnostics copied.', 'success');
		} catch {
			toast('Your browser blocked the clipboard.', 'error');
		}
	}

	function visibility() {
		if (!listening) return;

		if (document.hidden) {
			release();
			return;
		}

		void resume();
	}

	function listen() {
		pinned = true;

		if (listening) {
			disable();
			return;
		}

		void enable();
	}

	function show() {
		open = true;
		pinned = true;
		popover = 'commands';
	}

	function forget() {
		if (expiry) clearTimeout(expiry);
		expiry = null;
		pending = null;
	}

	function hold(chosen: { name: CommandName; text: string }) {
		if (expiry) clearTimeout(expiry);

		pending = chosen;
		expiry = setTimeout(forget, confirmWindow);
		announce(`To confirm, you wanted me to ${commandInfo[chosen.name].action}?`);
	}

	function run(chosen: { name: CommandName; text: string }) {
		if (chosen.name === 'moderate') {
			moderate(chosen.text);
			return;
		}

		if (
			chosen.name === 'startShift' ||
			chosen.name === 'endShift' ||
			chosen.name === 'breakShift'
		) {
			manage(chosen.name, chosen.text);
			return;
		}

		ask(chosen.name);
	}

	function agree() {
		const chosen = pending;
		forget();

		if (chosen) run(chosen);
	}

	function refuse() {
		forget();
		announce('Cancelled.');
	}

	function review(texts: string[]) {
		if (pending) {
			const answer = texts.map((text) => matchAnswer(text)).find((value) => value !== null) ?? null;

			if (answer === true) {
				agree();
				return;
			}

			if (answer === false) {
				refuse();
				return;
			}

			forget();
		}

		const chosen = pick(texts);

		if (!chosen) {
			announce("I don't think that's a valid command, please try again.");
			return;
		}

		if (!accepts(chosen.score)) {
			hold(chosen);
			return;
		}

		run(chosen);
	}

	function moderate(text: string) {
		stage = '';
		info = '';
		show();

		const { type: chosen } = chooseType(text, punishmentTypes);
		start(chosen, true);
	}

	function manage(name: 'startShift' | 'endShift' | 'breakShift', text: string) {
		forget();
		info = '';
		step = '';

		if (panel.pending) {
			announce('Another shift action is still running.');
			return;
		}

		if (name === 'startShift') {
			if (mine) {
				announce(`You are already ${mine.onBreak ? 'on break' : 'on duty'} as ${mine.type}.`);
				return;
			}

			const { type: named, spoken } = chooseType(text, shiftOptions);

			if (!named && spoken) {
				announce(`No shift type matches "${spoken}".`);
				return;
			}

			const picked = named || shiftOptions[0];
			void panel.act('start', { action: 'shift.start', type: picked });
			announce(`Started a ${picked} shift.`);
			return;
		}

		if (!mine) {
			announce('You are not on shift.');
			return;
		}

		if (name === 'breakShift') {
			void panel.act('break', { action: 'shift.break', id: mine.id });
			announce(mine.onBreak ? 'Resuming your shift.' : 'Going on break.');
			return;
		}

		const since = spokenDuration(Math.floor(Date.now() / 1000) - mine.startEpoch);
		void panel.act('end', { action: 'shift.end', id: mine.id });
		announce(`Ended your ${mine.type} shift after ${since}.`);
	}

	function ask(topic: InfoTopic) {
		forget();
		info = topic;
		asked = Date.now();
		step = '';
		announce(reply);
	}

	function start(punishment: string, voice = false) {
		forget();
		type = punishment;
		player = '';
		reason = '';
		highlight = -1;
		info = '';
		picking = !punishment;
		voiced = voice;
		step = punishment ? 'player' : 'type';
	}

	function back() {
		if (stepIndex > 0) {
			step = flow[stepIndex - 1];
			return;
		}

		if (voiced) {
			close();
			return;
		}

		step = '';
	}

	function build() {
		if (!player.trim() || !reason.trim()) return;

		fill({
			player: bestMatch(player, roster),
			spokenPlayer: player.trim(),
			type,
			reason: reason.trim()
		});
	}

	function steer(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlight = suggestions.length ? (highlight + 1) % suggestions.length : -1;
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlight = suggestions.length ? (highlight <= 0 ? suggestions.length : highlight) - 1 : -1;
			return;
		}

		if (event.key !== 'Enter') return;
		event.preventDefault();

		if (event.shiftKey) {
			back();
			return;
		}

		const chosen = suggestions[highlight];

		if (chosen) {
			player = chosen.name;
			highlight = -1;
			return;
		}

		if (player.trim()) step = 'reason';
	}

	function commit(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();

		if (event.shiftKey) {
			back();
			return;
		}

		build();
	}

	function fill(command: Command) {
		const found = known.find((entry) => entry.id && entry.name === command.player);

		if (!found) {
			toast(`No player matches "${command.spokenPlayer}".`, 'error');
			return;
		}

		onfill({
			id: found.id,
			username: found.name,
			type: command.type || punishmentTypes[0] || '',
			reason: command.reason
		});

		player = '';
		reason = '';
		close();
	}

	function close() {
		open = false;
		pinned = false;
		popover = '';
		step = '';
		picking = false;
		voiced = false;
	}

	function toggle(name: string) {
		pinned = true;
		popover = popover === name ? '' : name;
		if (popover === 'settings') void loadDevices();
	}

	function escape(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !open) return;

		if (step) {
			back();
			return;
		}

		if (popover) {
			popover = '';
			return;
		}

		close();
	}

	function outside(event: PointerEvent) {
		if (!open || !host || host.contains(event.target as Node)) return;

		close();
	}
</script>

<svelte:window onkeydown={escape} onpointerdown={outside} />
<svelte:document onvisibilitychange={visibility} />

<div
	bind:this={host}
	role="presentation"
	onpointerenter={() => (open = true)}
	onpointerleave={() => !pinned && (open = false)}
	onfocusin={() => {
		open = true;
		pinned = true;
	}}
	class="pwa-safe-bottom fixed bottom-0 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center"
>
	{#if open}
		<div
			transition:fly={{ y: 8, duration: 150 }}
			class="relative mb-1 flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-2xl shadow-black/60"
		>
			<Tooltip text="Commands">
				<button
					type="button"
					onclick={() => toggle('commands')}
					aria-label="Moderation commands"
					aria-expanded={popover === 'commands'}
					class="tap rounded-lg p-2 transition-colors {popover === 'commands'
						? 'bg-white/10 text-white'
						: 'text-muted hover:bg-white/5 hover:text-white'}"
				>
					<List class="h-4 w-4" />
				</button>
			</Tooltip>

			<Tooltip text={listening ? `${micLabel}, click to stop` : micLabel}>
				<button
					type="button"
					disabled={!supported}
					onclick={listen}
					aria-label={listening ? `Stop listening, ${micLabel}` : micLabel}
					aria-pressed={listening}
					class="tap flex items-center gap-1.5 rounded-lg p-2 transition-colors disabled:opacity-50 {micState ===
					'live'
						? 'bg-red-500/20 text-red-300'
						: micState === 'starting' || micState === 'paused'
							? 'bg-amber-500/20 text-amber-300'
							: 'text-muted hover:bg-white/5 hover:text-white'}"
				>
					{#if micState === 'live'}
						<Mic class="h-4 w-4" />
					{:else}
						<MicOff class="h-4 w-4" />
					{/if}

					{#if micState === 'paused' || micState === 'starting'}
						<span class="text-[11px] font-semibold tracking-wide uppercase">
							{micState === 'paused' ? 'Paused' : 'Starting'}
						</span>
					{/if}
				</button>
			</Tooltip>

			<Tooltip text="Audio devices">
				<button
					type="button"
					onclick={() => toggle('settings')}
					aria-label="Audio device settings"
					aria-expanded={popover === 'settings'}
					class="tap rounded-lg p-2 transition-colors {popover === 'settings'
						? 'bg-white/10 text-white'
						: 'text-muted hover:bg-white/5 hover:text-white'}"
				>
					<Settings2 class="h-4 w-4" />
				</button>
			</Tooltip>

			<div
				class="pointer-events-none absolute bottom-full left-1/2 flex w-[min(22rem,calc(100vw-1rem))] -translate-x-1/2 flex-col-reverse items-center gap-2 pb-2"
			>
				{#if popover === 'commands'}
					<div
						transition:fly={{ y: 6, duration: 150 }}
						class="pointer-events-auto flex max-h-[calc(100dvh-9rem)] w-full flex-col gap-2 rounded-xl border border-line bg-surface p-3 shadow-2xl shadow-black/60 {step ===
						'type'
							? ''
							: 'overflow-y-auto'}"
					>
						{#if step}
							<div class="flex items-center gap-2">
								{#if stepIndex > 0 || !voiced}
									<button
										type="button"
										onclick={back}
										aria-label="Previous step"
										class="tap shrink-0 rounded-lg border border-line bg-white/5 p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
									>
										<ArrowLeft class="h-3.5 w-3.5" />
									</button>
								{/if}

								<p class="min-w-0 flex-1 truncate text-[11px] tracking-wide text-muted uppercase">
									Step {stepIndex + 1} of {flow.length}{type ? ` - ${type}` : ''}{step === 'reason'
										? ` - ${player}`
										: ''}
								</p>
							</div>

							{#if step === 'type'}
								<div class="flex flex-col gap-2" in:fly={{ x: 10, duration: 150 }}>
									<Select
										options={typeOptions}
										bind:value={type}
										placeholder="Choose a punishment type"
									/>

									<button
										type="button"
										onclick={() => type && (step = 'player')}
										disabled={!type}
										class="rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
									>
										Next
									</button>
								</div>
							{:else if step === 'player'}
								<div class="flex items-center gap-2" in:fly={{ x: 10, duration: 150 }}>
									<input
										bind:this={field}
										bind:value={player}
										onkeydown={steer}
										oninput={() => (highlight = -1)}
										placeholder="Player name"
										aria-label="Player name"
										autocomplete="off"
										role="combobox"
										aria-expanded={suggestions.length > 0}
										aria-controls="speech-suggestions"
										aria-activedescendant={highlight >= 0
											? `speech-suggestion-${highlight}`
											: undefined}
										class="w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted focus:border-line focus:ring-0"
									/>

									<button
										type="button"
										onclick={() => player.trim() && (step = 'reason')}
										disabled={!player.trim()}
										class="shrink-0 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
									>
										Next
									</button>
								</div>

								{#if suggestions.length}
									<ul
										id="speech-suggestions"
										role="listbox"
										aria-label="Players seen before"
										class="flex max-h-32 flex-col overflow-y-auto rounded-lg border border-line p-1"
									>
										{#each suggestions as entry, index (entry.id + entry.name)}
											<li>
												<button
													type="button"
													id="speech-suggestion-{index}"
													role="option"
													aria-selected={index === highlight}
													onclick={() => {
														player = entry.name;
														highlight = -1;
														step = 'reason';
													}}
													onmouseenter={() => (highlight = index)}
													class="w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors {index ===
													highlight
														? 'bg-white/8 text-white'
														: 'text-muted hover:bg-white/5'}"
												>
													{entry.name}
												</button>
											</li>
										{/each}
									</ul>
								{/if}
							{:else}
								<div class="flex items-center gap-2" in:fly={{ x: 10, duration: 150 }}>
									<input
										bind:this={field}
										bind:value={reason}
										onkeydown={commit}
										placeholder="Reason"
										aria-label="Reason"
										autocomplete="off"
										class="w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm placeholder:text-muted focus:border-line focus:ring-0"
									/>

									<button
										type="button"
										onclick={build}
										disabled={!reason.trim()}
										class="shrink-0 rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
									>
										Review
									</button>
								</div>
							{/if}

							{#if step !== 'type'}
								<p class="text-[11px] text-muted">Enter continues, shift and enter goes back.</p>
							{/if}
						{:else}
							<p class="text-[11px] font-semibold tracking-wide text-muted uppercase">
								Things you can say
							</p>

							<div class="flex flex-col gap-1" in:fly={{ y: 4, duration: 150 }}>
								{#each rows as row (row.key)}
									<button
										type="button"
										onclick={row.run}
										class="truncate rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors {row.active
											? 'bg-white/10 text-white'
											: 'text-muted hover:bg-white/5 hover:text-white'}"
									>
										"{row.phrase}"
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				{#if popover === 'settings'}
					<div
						transition:fly={{ y: 6, duration: 150 }}
						class="pointer-events-auto flex w-[min(18rem,100%)] flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-2xl shadow-black/60"
					>
						<div>
							<p class="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
								Microphone
							</p>
							<Select
								options={mics}
								bind:value={mic}
								placeholder="System default"
								onchange={(next) => storeDevice('mic', next)}
							/>
						</div>

						<div>
							<p class="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
								Speaker
							</p>

							{#if sinkSupported}
								<Select
									options={speakers}
									bind:value={speaker}
									placeholder="System default"
									onchange={(next) => storeDevice('speaker', next)}
								/>
							{:else}
								<p class="py-2 text-xs text-muted">
									This browser cannot choose an output device, so tones use the system default.
								</p>
							{/if}
						</div>

						<div>
							<p class="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
								Recognition language
							</p>
							<Select
								options={langs}
								bind:value={lang}
								placeholder="Browser default"
								onchange={(next) => {
									storeLang(next);
									relisten();
								}}
							/>
						</div>

						<div class="flex items-center justify-between gap-3 border-t border-line pt-3">
							<div class="min-w-0">
								<p class="text-xs font-medium">Diagnostics</p>
								<p class="text-[11px] text-muted">Show what the recogniser is hearing.</p>
							</div>

							<Switch
								bind:checked={
									() => diagnostics,
									(next) => {
										diagnostics = next;
										storeDiagnostics(next);
									}
								}
								label="Speech diagnostics"
							/>
						</div>
					</div>
				{/if}

				{#if diagnostics}
					<div
						transition:fly={{ y: 6, duration: 150 }}
						class="pointer-events-auto flex w-full flex-col gap-2 rounded-xl border border-line bg-surface p-3 shadow-2xl shadow-black/60"
					>
						<div class="flex items-center justify-between gap-2">
							<p class="text-[11px] font-semibold tracking-wide text-muted uppercase">
								Speech diagnostics
							</p>

							<button
								type="button"
								onclick={copyReport}
								aria-label="Copy diagnostics"
								class="tap rounded-lg border border-line bg-white/5 p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
							>
								<Copy class="h-3.5 w-3.5" />
							</button>
						</div>

						<pre
							class="max-h-64 overflow-auto rounded-lg border border-line bg-black/30 p-2 font-mono text-[11px] leading-relaxed whitespace-pre text-muted select-text">{report}</pre>
					</div>
				{/if}

				{#if pending}
					<div
						transition:fly={{ y: 6, duration: 150 }}
						class="pointer-events-auto flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-2xl shadow-black/60"
						aria-live="polite"
					>
						<p class="min-w-0 flex-1 text-xs">
							To confirm, you wanted me to {commandInfo[pending.name].action}?
						</p>

						<button
							type="button"
							onclick={agree}
							class="shrink-0 rounded-lg border border-line bg-white/5 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-white/10"
						>
							Yes
						</button>

						<button
							type="button"
							onclick={refuse}
							class="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-white/5 hover:text-white"
						>
							No
						</button>
					</div>
				{/if}

				{#if listening || remembered || transcript}
					<div
						transition:fly={{ y: 6, duration: 150 }}
						class="pointer-events-auto flex max-w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-2xl shadow-black/60"
						aria-live="polite"
					>
						<span
							class="h-1.5 w-1.5 shrink-0 rounded-full {micState === 'live'
								? stage
									? 'animate-pulse bg-red-400'
									: 'bg-red-400'
								: 'animate-pulse bg-amber-400'}"
						></span>

						<span
							class="min-w-0 text-xs {transcript
								? 'text-white'
								: `font-semibold ${micState === 'live' ? 'text-red-300' : 'text-amber-300'}`}"
						>
							{transcript || status || micLabel}
						</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if !open && status}
		<div
			transition:fly={{ y: 6, duration: 150 }}
			class="mb-1.5 flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 shadow-2xl shadow-black/60"
			aria-live="polite"
		>
			<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400"></span>
			<span class="text-[0.6875rem] font-semibold text-red-300">
				{status}
			</span>
		</div>
	{/if}

	<button
		type="button"
		onclick={() => {
			open = true;
			pinned = true;
		}}
		aria-label="Speech control"
		aria-expanded={open}
		class="flex h-6 w-28 items-center justify-center rounded-t-xl border border-b-0 border-line bg-surface text-muted transition-colors hover:bg-white/8 hover:text-white {micState ===
		'live'
			? 'text-red-300'
			: micState === 'starting' || micState === 'paused'
				? 'text-amber-300'
				: ''}"
	>
		<Mic class="h-3.5 w-3.5" />
	</button>
</div>
