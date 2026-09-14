import { browser } from '$app/environment';

export const tones = {
	alert: '/tones/Alert.mp3',
	moderation: '/media/moderation.mp3'
} as const;

export type Tone = keyof typeof tones;

const muteKey = 'panelTonesMuted';

export function tonesMuted(): boolean {
	if (!browser) return false;

	try {
		return localStorage.getItem(muteKey) === '1';
	} catch {
		return false;
	}
}

export function muteTones(muted: boolean) {
	if (!browser) return;

	try {
		localStorage.setItem(muteKey, muted ? '1' : '0');
	} catch {
		return;
	}
}

const loaded: Partial<Record<Tone, HTMLAudioElement>> = {};

export function toneAudio(tone: Tone): HTMLAudioElement | null {
	if (!browser) return null;

	const existing = loaded[tone];
	if (existing) return existing;

	const audio = new Audio(tones[tone]);
	audio.preload = 'auto';
	loaded[tone] = audio;

	return audio;
}

export function playTone(tone: Tone, volume = 1) {
	if (tonesMuted()) return;

	const audio = toneAudio(tone);
	if (!audio) return;

	audio.volume = volume;
	audio.currentTime = 0;

	void audio.play().catch(() => null);
}
