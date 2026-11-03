/* Licensed under the MIT License. */
export interface GozappModelForm {
	name: string;
	baseUrl: string;
	modelIds: string;
	apiType: string;
	inputTokens: number;
	outputTokens: number;
	toolCalling: boolean;
	vision: boolean;
}

export function isValidGozappModelId(id: string): boolean {
	return id.length > 0 && id.length <= 200 && !/[\s,]/.test(id);
}

export function buildGozappModelGroup(form: GozappModelForm) {
	const name = form.name.trim();
	if (!name || name.length > 100) {
		throw new Error('Enter a provider name (1–100 characters).');
	}
	const url = new URL(form.baseUrl.trim());
	if (url.username || url.password || url.search || url.hash ||
		(url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
		throw new Error('Use HTTPS, or HTTP on localhost. Credentials and query parameters are not allowed in the URL.');
	}
	const suffix = { 'chat-completions': '/chat/completions', responses: '/responses', messages: '/messages' }[form.apiType];
	if (!suffix) {
		throw new Error('Select a supported API type.');
	}
	url.pathname = url.pathname.replace(/\/+$/, '');
	if (!url.pathname.endsWith(suffix)) {
		url.pathname += suffix;
	}
	const ids = [...new Set(form.modelIds.split(/[\n,]/).map(id => id.trim()).filter(Boolean))];
	if (!ids.length || ids.length > 100 || ids.some(id => !isValidGozappModelId(id))) {
		throw new Error('Enter 1–100 model IDs, one per line or separated by commas, without spaces.');
	}
	if (![form.inputTokens, form.outputTokens].every(n => Number.isSafeInteger(n) && n > 0 && n <= 10000000)) {
		throw new Error('Token limits must be positive whole numbers, no more than 10,000,000.');
	}
	return {
		name, vendor: 'customendpoint', apiType: form.apiType,
		models: ids.map(id => ({
			id, name: id, url: url.toString(), toolCalling: form.toolCalling, vision: form.vision,
			maxInputTokens: form.inputTokens, maxOutputTokens: form.outputTokens,
		})),
	};
}
