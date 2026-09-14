import { error } from '@sveltejs/kit';
import { getMyModerations, getOverviewSettings } from '$lib/server/overview';
import type { RequestHandler } from './$types';

const streamInterval = 20_000;
const keepAlive = 20_000;

export const GET: RequestHandler = async ({ params, locals }) => {
	const guildId = params.guildID;
	if (!/^\d{17,20}$/.test(guildId)) error(404, 'That server does not exist.');

	const token = locals.token ?? '';
	if (!token) error(401, 'Sign in to follow your logs.');

	const settings = await getOverviewSettings(guildId);
	if (!settings.panels.moderations) {
		error(404, 'This server does not let members view their own logs.');
	}

	let timer: ReturnType<typeof setInterval> | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	const stop = () => {
		if (timer) clearInterval(timer);
		if (heartbeat) clearInterval(heartbeat);
		timer = null;
		heartbeat = null;
	};

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			let signature = '';

			const tick = async () => {
				const record = await getMyModerations(token, guildId);
				if (!record) return;

				const next = JSON.stringify(record);
				if (next === signature) return;

				signature = next;

				try {
					controller.enqueue(encoder.encode(`event: record\ndata: ${next}\n\n`));
				} catch {
					stop();
				}
			};

			void tick();

			timer = setInterval(() => void tick(), streamInterval);

			heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': keep-alive\n\n'));
				} catch {
					stop();
				}
			}, keepAlive);
		},

		cancel() {
			stop();
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
