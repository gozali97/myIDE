/* Licensed under the MIT License. */
export function getGozappActivityAge(now: number, lastEvent: number): { seconds: number; quiet: boolean } {
	const seconds = Math.max(0, Math.floor((now - lastEvent) / 1000));
	return { seconds, quiet: seconds >= 30 };
}
