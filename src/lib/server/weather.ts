import { TtlCache } from './cache';

export interface Place {
	label: string;
	latitude: number;
	longitude: number;
	timezone: string;
}

export interface Weather {
	location: string;
	timezone: string;
	currentTime: string;
	isDay: boolean;
	type: string;
	label: string;
	matches: string[];
}

const proxy = 'https://proxy.ermbot.xyz/api';
const geocoder = 'https://geocoding-api.open-meteo.com/v1/search';
const timeout = 8000;
const count = 8;

const cache = new TtlCache<Weather | null>(5 * 60_000, 500);
const lookups = new TtlCache<Place[]>(60 * 60_000, 500);

const conditions: Record<number, { type: string; label: string }> = {
	0: { type: 'clear', label: 'Clear sky' },
	1: { type: 'clear', label: 'Mainly clear' },
	2: { type: 'cloudy', label: 'Partly cloudy' },
	3: { type: 'cloudy', label: 'Overcast' },
	45: { type: 'fog', label: 'Fog' },
	48: { type: 'fog', label: 'Freezing fog' },
	51: { type: 'rain', label: 'Light drizzle' },
	53: { type: 'rain', label: 'Drizzle' },
	55: { type: 'rain', label: 'Heavy drizzle' },
	56: { type: 'rain', label: 'Freezing drizzle' },
	57: { type: 'rain', label: 'Freezing drizzle' },
	61: { type: 'rain', label: 'Light rain' },
	63: { type: 'rain', label: 'Rain' },
	65: { type: 'rain', label: 'Heavy rain' },
	66: { type: 'rain', label: 'Freezing rain' },
	67: { type: 'rain', label: 'Freezing rain' },
	71: { type: 'snow', label: 'Light snow' },
	73: { type: 'snow', label: 'Snow' },
	75: { type: 'snow', label: 'Heavy snow' },
	77: { type: 'snow', label: 'Snow grains' },
	80: { type: 'rain', label: 'Light showers' },
	81: { type: 'rain', label: 'Showers' },
	82: { type: 'rain', label: 'Heavy showers' },
	85: { type: 'snow', label: 'Snow showers' },
	86: { type: 'snow', label: 'Heavy snow showers' },
	95: { type: 'thunder', label: 'Thunderstorm' },
	96: { type: 'thunder', label: 'Thunderstorm with hail' },
	99: { type: 'thunder', label: 'Thunderstorm with hail' }
};

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function num(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function call(url: string): Promise<Record<string, unknown> | null> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
		if (!response.ok) return null;

		return (await response.json()) as Record<string, unknown>;
	} catch (error) {
		console.warn(`${url} failed:`, error);
		return null;
	}
}

function readPlaces(body: Record<string, unknown> | null, name: string): Place[] {
	const results = (body?.results ?? []) as Record<string, unknown>[];

	return results.flatMap((result) => {
		const latitude = num(result.latitude);
		const longitude = num(result.longitude);
		if (latitude === null || longitude === null) return [];

		if (!text(result.feature_code).startsWith('PPL')) return [];
		if (text(result.name).toLowerCase() !== name) return [];

		const label = [text(result.name), text(result.admin1), text(result.country)]
			.filter(Boolean)
			.join(', ');
		if (!label) return [];

		return [{ label, latitude, longitude, timezone: text(result.timezone) || 'auto' }];
	});
}

export async function findPlaces(query: string): Promise<Place[]> {
	const parts = query
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);

	const name = parts[0] ?? '';
	if (!name) return [];

	const key = query.trim().toLowerCase();
	const cached = lookups.get(key);
	if (cached) return cached;

	return lookups.dedupe(key, async () => {
		const search = `${encodeURIComponent(name)}&count=${count}`;

		let found = readPlaces(await call(`${proxy}/geocode?location=${search}`), name.toLowerCase());
		if (found.length < 2) {
			const extra = readPlaces(
				await call(`${geocoder}?name=${search}&language=en&format=json`),
				name.toLowerCase()
			);
			if (extra.length > found.length) found = extra;
		}

		const qualifiers = parts.slice(1).map((part) => part.toLowerCase());
		const ranked = [...found].sort((a, b) => score(b, qualifiers) - score(a, qualifiers));

		lookups.set(key, ranked);
		return ranked;
	});
}

function score(place: Place, qualifiers: string[]): number {
	const label = place.label.toLowerCase();
	return qualifiers.filter((qualifier) => label.includes(qualifier)).length;
}

async function forecast(place: Place, matches: string[]): Promise<Weather | null> {
	const url = `${proxy}/weather?lat=${place.latitude}&lon=${place.longitude}&timezone=${encodeURIComponent(place.timezone)}`;
	const body = await call(url);
	if (!body) return null;

	const current = (body.current ?? {}) as Record<string, unknown>;
	const code = num(current.weather_code);
	const condition = (code !== null && conditions[code]) || { type: 'cloudy', label: 'Unknown' };

	return {
		location: place.label,
		timezone: place.timezone,
		currentTime: text(current.time),
		isDay: num(current.is_day) === 1,
		type: condition.type,
		label: condition.label,
		matches
	};
}

export async function getWeather(location: string): Promise<Weather | null> {
	const query = location.trim();
	if (!query) return null;

	const key = query.toLowerCase();
	const cached = cache.get(key);
	if (cached !== undefined) return cached;

	return cache.dedupe(key, async () => {
		const found = await findPlaces(query);
		if (!found.length) {
			cache.set(key, null);
			return null;
		}

		const weather = await forecast(
			found[0],
			found.map((place) => place.label)
		);
		cache.set(key, weather);
		return weather;
	});
}
