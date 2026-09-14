import { managementLevel } from './dashboard';
import type { Channel, Role } from './server/discord';

export const guildData = $state<{
	name: string;
	roles: Role[] | null | undefined;
	channels: Channel[] | null | undefined;
	locked: boolean;
	level: number;
	reviewer: boolean;
}>({
	name: '',
	roles: undefined,
	channels: undefined,
	locked: true,
	level: managementLevel,
	reviewer: false
});
