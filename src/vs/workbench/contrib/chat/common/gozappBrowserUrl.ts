/* Licensed under the MIT License. */
export function validateGozappBrowserUrl(value: string): string {
	const url = new URL(value.trim());
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		throw new Error('Use an HTTP or HTTPS URL without embedded credentials.');
	}
	return url.toString();
}
