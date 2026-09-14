import { defaultAvatar } from './discord';
import { call, getDiscordProfiles, type Reply } from './panel';

export interface LoaRecord {
	id: string;
	userId: string;
	username: string;
	avatarUrl: string;
	reason: string;
	startedAt: number;
	expiry: number;
	expired: boolean;
	accepted: boolean;
	denied: boolean;
}

function reason(reply: Reply | null, fallback: string): string {
	const message = reply?.body.message;
	return typeof message === 'string' && message ? message : fallback;
}

function readLoa(raw: Record<string, unknown>): LoaRecord {
	const id = String(raw.ID ?? '');

	return {
		id,
		userId: String(raw.UserID ?? ''),
		username: '',
		avatarUrl: '',
		reason: typeof raw.Reason === 'string' && raw.Reason ? raw.Reason : 'No reason given',
		startedAt: Number(id.split('_')[2]) || 0,
		expiry: Number(raw.Expiry) || 0,
		expired: raw.Expired === true,
		accepted: raw.Accepted === true,
		denied: raw.Denied === true
	};
}

export async function getGuildLoas(token: string, guildId: string): Promise<LoaRecord[] | null> {
	const reply = await call(token, `/${guildId}/GetServerLOAs`);
	if (!reply || reply.status !== 200) return null;

	const rows = Array.isArray(reply.body.LOAs) ? (reply.body.LOAs as Record<string, unknown>[]) : [];
	const records = rows.map(readLoa).filter((record) => record.id && record.userId);

	const profiles = await getDiscordProfiles(token, [
		...new Set(records.map((record) => record.userId))
	]);

	for (const record of records) {
		const profile = profiles.get(record.userId);
		record.username = profile?.username ?? '';
		record.avatarUrl = profile?.avatarUrl ?? defaultAvatar(record.userId);
	}

	return records.sort((a, b) => b.startedAt - a.startedAt);
}

export async function acceptLoa(
	token: string,
	guildId: string,
	loaId: string
): Promise<string | null> {
	const reply = await call(token, `/${guildId}/${loaId}/AcceptLOA`, { method: 'POST' });
	if (!reply || reply.status !== 200) {
		return reason(reply, 'Could not accept that request, try again.');
	}

	return null;
}

export async function denyLoa(
	token: string,
	guildId: string,
	loaId: string,
	message: string
): Promise<string | null> {
	const reply = await call(token, `/${guildId}/${loaId}/DenyLOA`, {
		method: 'POST',
		body: JSON.stringify({ reason: message })
	});
	if (!reply || reply.status !== 200) {
		return reason(reply, 'Could not deny that request, try again.');
	}

	return null;
}

export async function startLoa(
	token: string,
	guildId: string,
	expiry: number,
	message: string
): Promise<string | null> {
	const reply = await call(token, `/${guildId}/StartUserLOA`, {
		method: 'POST',
		body: JSON.stringify({ expiry: String(expiry), reason: message })
	});
	if (!reply || reply.status !== 200) {
		return reason(reply, 'Could not file that leave request, try again.');
	}

	return null;
}

export async function forceStartLoa(
	token: string,
	guildId: string,
	userId: string,
	expiry: number,
	message: string
): Promise<string | null> {
	const reply = await call(token, `/${guildId}/${userId}/ForceStartLOA`, {
		method: 'POST',
		body: JSON.stringify({ expiry: String(expiry), reason: message })
	});
	if (!reply || reply.status !== 200) {
		return reason(reply, 'Could not start that leave, try again.');
	}

	return null;
}

export async function endLoa(
	token: string,
	guildId: string,
	loaId: string,
	forced: boolean
): Promise<string | null> {
	const path = forced ? 'ForceEndLOA' : 'EndUserLOA';
	const reply = await call(token, `/${guildId}/${loaId}/${path}`, { method: 'PATCH' });
	if (!reply || reply.status !== 200) {
		return reason(reply, 'Could not end that leave, try again.');
	}

	return null;
}

export async function deleteLoa(
	token: string,
	guildId: string,
	loaId: string
): Promise<string | null> {
	const reply = await call(token, `/${guildId}/${loaId}/DeleteUserLOA`, { method: 'DELETE' });
	if (!reply || reply.status !== 200) {
		return reason(reply, 'Could not delete that leave, try again.');
	}

	return null;
}

export async function getMyLoas(token: string, guildId: string): Promise<LoaRecord[] | null> {
	const reply = await call(token, `/${guildId}/GetUserLOAs`);
	if (!reply || reply.status !== 200) return null;

	const rows = Array.isArray(reply.body.LOAs) ? (reply.body.LOAs as Record<string, unknown>[]) : [];

	return rows
		.map(readLoa)
		.filter((record) => record.id)
		.sort((a, b) => b.startedAt - a.startedAt);
}

export async function endMyLoa(
	token: string,
	guildId: string,
	loaId: string
): Promise<string | null> {
	const reply = await call(token, `/${guildId}/EndMyLOA/${loaId}`, { method: 'POST' });
	if (!reply || reply.status !== 200) {
		return reason(reply, 'Could not end that leave, try again.');
	}

	return null;
}
