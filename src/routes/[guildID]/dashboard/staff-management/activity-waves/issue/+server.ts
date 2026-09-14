import { json } from '@sveltejs/kit';
import { authorizeStrict } from '$lib/server/dashboard';
import { requireUser } from '$lib/server/session';
import { issueInfractions } from '$lib/server/staff';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { token, guild } = await authorizeStrict(event);
	const issuer = await requireUser(event.locals, event.url);

	const body = (await event.request.json().catch(() => null)) as Record<string, unknown> | null;
	const userId = String(body?.userId ?? '').trim();
	const username = String(body?.username ?? '').trim();
	const infractionType = String(body?.infractionType ?? '')
		.trim()
		.slice(0, 32);
	const reasonText =
		String(body?.reason ?? '')
			.trim()
			.slice(0, 500) || 'Missed quota during an activity wave.';

	if (!/^\d{17,20}$/.test(userId)) {
		return json({ ok: false, message: 'Invalid member.' }, { status: 400 });
	}
	if (infractionType.length < 2) {
		return json({ ok: false, message: 'Choose an infraction type first.' }, { status: 400 });
	}

	const [result] = await issueInfractions(
		token,
		guild.id,
		issuer,
		[{ userId, username }],
		infractionType,
		reasonText
	);

	return json({ ok: result.ok, message: result.message });
};
