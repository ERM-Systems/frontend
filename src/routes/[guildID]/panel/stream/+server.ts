import { authorizePanel } from '$lib/server/panel';
import { subscribe } from '$lib/server/panelStream';
import type { RequestHandler } from './$types';

const keepAlive = 20_000;

export const GET: RequestHandler = async (event) => {
	const access = await authorizePanel(event);

	let release: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	const stop = () => {
		if (heartbeat) clearInterval(heartbeat);
		heartbeat = null;
		release?.();
		release = null;
	};

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			const send = (name: string, payload: unknown) => {
				try {
					controller.enqueue(
						encoder.encode(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`)
					);
				} catch {
					stop();
				}
			};

			release = subscribe(access.token, access.guildId, access.discordId, send);

			heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': keep-alive\n\n'));
				} catch {
					stop();
				}
			}, keepAlive);
		},

		cancel: stop
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
};
