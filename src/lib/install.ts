export function isAppleTouchDevice(userAgent: string, maxTouchPoints: number): boolean {
	if (/iPhone|iPod/.test(userAgent)) return true;
	return /Macintosh|iPad/.test(userAgent) && maxTouchPoints > 1;
}

export function needsManualInstall(
	userAgent: string,
	maxTouchPoints: number,
	hasInstallEvent: boolean
): boolean {
	return isAppleTouchDevice(userAgent, maxTouchPoints) && !hasInstallEvent;
}
