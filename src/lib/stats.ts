export interface DailyActivity {
	moderations: number;
	shifts: number;
	seconds: number;
}

export interface Stats {
	days: number;
	earliest: number;
	shifts: number;
	onDutySeconds: number;
	longestShift: number;
	averageShift: number;
	moderations: number;
	moderationsByType: Record<string, number>;
	guilds: number;
	daily: Record<string, DailyActivity>;
}
