import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { authorizeGuild } from '$lib/server/dashboard';
import { throttle, throttleMessage } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

const maxBytes = 5 * 1024 * 1024;
const maxVideoBytes = 50 * 1024 * 1024;

function fileUrl(entry: unknown): string {
	const value =
		typeof entry === 'string'
			? entry
			: typeof entry === 'object' && entry
				? String((entry as Record<string, unknown>).url ?? '')
				: '';

	return value.startsWith('https://') ? value : '';
}

export const POST: RequestHandler = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const wait = throttle(`upload:${token}:${guild.id}`);
	if (wait) return json({ message: throttleMessage(wait) }, { status: 429 });

	const incoming = await event.request.formData().catch((reason) => {
		const size = event.request.headers.get('content-length') ?? 'unknown';
		console.warn(`/api/upload could not read a ${size} byte body:`, reason);
		return null;
	});
	if (!incoming) error(413, 'That file is too large to upload.');

	const file = incoming.get('file');

	if (!(file instanceof File)) error(400, 'Choose a file to upload.');

	const video = file.type.startsWith('video/');
	if (!file.type.startsWith('image/') && !video) {
		error(415, 'Only image and video files can be uploaded.');
	}
	if (file.size > (video ? maxVideoBytes : maxBytes)) {
		error(
			413,
			video ? 'Videos have to be smaller than 50MB.' : 'Images have to be smaller than 5MB.'
		);
	}

	if (!env.VITE_INTERNAL_URL) error(502, 'Uploads are unavailable right now, try again shortly.');

	const body = new FormData();
	body.append('file', new Blob([await file.arrayBuffer()], { type: file.type }), file.name);

	const started = performance.now();
	const response = await fetch(`${env.VITE_INTERNAL_URL}/FileProxy/Upload`, {
		method: 'POST',
		headers: { Authorization: token },
		body,
		signal: AbortSignal.timeout(30_000)
	}).catch((reason) => {
		console.warn(
			`/FileProxy/Upload failed after ${Math.round(performance.now() - started)}ms:`,
			reason
		);
		return null;
	});

	if (!response?.ok) {
		if (response) console.warn('/FileProxy/Upload said:', (await response.text()).slice(0, 300));
		error(424, 'That upload did not go through, try again shortly.');
	}

	const payload = (await response.json().catch(() => ({}))) as { files?: unknown };
	const url = fileUrl(Array.isArray(payload.files) ? payload.files[0] : null);
	if (!url) {
		console.warn('/FileProxy/Upload returned:', JSON.stringify(payload).slice(0, 300));
		error(502, 'The upload finished without returning a link.');
	}

	return json({ url });
};
