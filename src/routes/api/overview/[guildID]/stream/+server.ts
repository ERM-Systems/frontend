import { error } from '@sveltejs/kit';
import { getOverviewSettings, overviewLive } from '$lib/server/overview';
import { lastSnapshot, streamInterval, subscribe } from '$lib/server/overviewStream';
import type { RequestHandler } from './$types';

const keepAlive = 20_000;

export const GET: RequestHandler = async ({ params }) => {
	const guildId = params.guildID;
	if (!/^\d{17,20}$/.test(guildId)) error(404, 'That server does not exist.');

	const settings = await getOverviewSettings(guildId);
	if (!settings.enabled) error(404, 'This server has not made its overview public.');

	const opening = lastSnapshot(guildId) ?? (await overviewLive(guildId, settings));

	let release: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			const send = (event: string, payload: unknown) => {
				try {
					controller.enqueue(
						encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
					);
				} catch {
					release?.();
				}
			};

			send('snapshot', opening);

			release = subscribe(guildId, (snapshot) => send('snapshot', snapshot));

			heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': keep-alive\n\n'));
				} catch {
					release?.();
				}
			}, keepAlive);
		},

		cancel() {
			release?.();
			release = null;
			if (heartbeat) clearInterval(heartbeat);
			heartbeat = null;
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store',
			connection: 'keep-alive',
			'x-accel-buffering': 'no',
			'x-poll-interval': String(streamInterval)
		}
	});
};
