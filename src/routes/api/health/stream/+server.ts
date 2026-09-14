import type { RequestHandler } from './$types';

const beat = 5_000;

export const GET: RequestHandler = () => {
	let timer: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			const send = () => {
				try {
					controller.enqueue(encoder.encode('event: beat\ndata: 1\n\n'));
				} catch {
					if (timer) clearInterval(timer);
					timer = null;
				}
			};

			send();
			timer = setInterval(send, beat);
		},

		cancel() {
			if (timer) clearInterval(timer);
			timer = null;
		}
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
