/* Licensed under the MIT License. */
interface ProbePart { type: string; value?: unknown }
export async function consumeGozappProbe(response: {
	stream: AsyncIterable<ProbePart | ProbePart[]>;
	result: Promise<unknown>;
}, onText: () => void): Promise<number> {
	let chunks = 0;
	const consume = async () => {
		for await (const part of response.stream) {
			for (const item of Array.isArray(part) ? part : [part]) {
				if (item.type === 'text' && typeof item.value === 'string' && item.value.length > 0) {
					chunks++;
					onText();
				}
			}
		}
	};
	// Observe result and stream errors concurrently; either may fail first.
	await Promise.all([consume(), response.result]);
	if (!chunks) { throw new Error('EMPTY_RESPONSE'); }
	return chunks;
}
