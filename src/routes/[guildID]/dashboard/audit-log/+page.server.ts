import { auditPerPage, getAuditLog } from '$lib/server/audit';
import { authorizeGuild } from '$lib/server/dashboard';
import type { PageServerLoad } from './$types';

export type { AuditEntry } from '$lib/server/audit';

export const load: PageServerLoad = async (event) => {
	const { token, guild } = await authorizeGuild(event);

	const page = Math.max(1, Math.trunc(Number(event.url.searchParams.get('page'))) || 1);
	const log = await getAuditLog(token, guild.id, page);

	return {
		entries: log?.entries ?? [],
		total: log?.total ?? 0,
		page,
		perPage: auditPerPage,
		unavailable: !log
	};
};
