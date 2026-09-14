export interface AopPoint {
	x: number;
	z: number;
}

export interface AopRegion {
	id: string;
	name: string;
	points: AopPoint[];
}

export const aopActions = ['wanted', 'kick', 'ban'] as const;

export type AopAction = (typeof aopActions)[number];

export interface AopSettings {
	enabled: boolean;
	sessions_only: boolean;
	regions: AopRegion[];
	default_region: string;
	grace_seconds: number;
	warnings: number;
	action: AopAction;
	warning_message: string;
}

export const mapSize = 3121;
export const maxRegions = 12;
export const maxPoints = 10;
export const minPoints = 3;

export function insideRegion(points: AopPoint[], probe: AopPoint): boolean {
	if (points.length < minPoints) return true;

	let inside = false;

	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const a = points[i];
		const b = points[j];

		if (onEdge(a, b, probe)) return true;

		const straddles = a.z > probe.z !== b.z > probe.z;
		if (!straddles) continue;

		const crossing = ((b.x - a.x) * (probe.z - a.z)) / (b.z - a.z) + a.x;
		if (probe.x < crossing) inside = !inside;
	}

	return inside;
}

function onEdge(a: AopPoint, b: AopPoint, probe: AopPoint): boolean {
	const cross = (b.x - a.x) * (probe.z - a.z) - (b.z - a.z) * (probe.x - a.x);
	if (Math.abs(cross) > 0.0001) return false;

	const withinX = probe.x >= Math.min(a.x, b.x) - 0.0001 && probe.x <= Math.max(a.x, b.x) + 0.0001;
	const withinZ = probe.z >= Math.min(a.z, b.z) - 0.0001 && probe.z <= Math.max(a.z, b.z) + 0.0001;

	return withinX && withinZ;
}

export function clampPoint(point: AopPoint): AopPoint {
	return {
		x: Math.min(mapSize, Math.max(0, Math.round(point.x))),
		z: Math.min(mapSize, Math.max(0, Math.round(point.z)))
	};
}

export function regionCentre(points: AopPoint[]): AopPoint {
	if (!points.length) return { x: mapSize / 2, z: mapSize / 2 };

	const total = points.reduce((sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }), {
		x: 0,
		z: 0
	});

	return { x: total.x / points.length, z: total.z / points.length };
}

export function blankRegion(name = 'Area of Play'): AopRegion {
	return { id: crypto.randomUUID(), name, points: [] };
}

export function defaultRegion(name = 'Area of Play'): AopRegion {
	const quarter = Math.round(mapSize / 4);

	return {
		id: crypto.randomUUID(),
		name,
		points: [
			{ x: quarter, z: quarter },
			{ x: mapSize - quarter, z: quarter },
			{ x: mapSize - quarter, z: mapSize - quarter },
			{ x: quarter, z: mapSize - quarter }
		]
	};
}

export const clickSlop = 4;

export function isClick(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
	return Math.abs(to.x - from.x) <= clickSlop && Math.abs(to.y - from.y) <= clickSlop;
}

export const maxWarningMessage = 200;

export function blankAopSettings(): AopSettings {
	return {
		enabled: false,
		sessions_only: true,
		regions: [],
		default_region: '',
		grace_seconds: 120,
		warnings: 3,
		action: 'kick',
		warning_message: 'You are outside the area of play. Return or you will be removed.'
	};
}

export function describeEnforcement(settings: AopSettings): string {
	const grace = settings.grace_seconds
		? `${Math.round(settings.grace_seconds / 60)} minute${settings.grace_seconds === 60 ? '' : 's'}`
		: 'no grace';

	const warnings = settings.warnings
		? `${settings.warnings} warning${settings.warnings === 1 ? '' : 's'}`
		: 'no warnings';

	const action = settings.action === 'wanted' ? 'marked wanted' : `${settings.action}ed`;

	return `After ${grace} outside, ${warnings}, then ${action}.`;
}
