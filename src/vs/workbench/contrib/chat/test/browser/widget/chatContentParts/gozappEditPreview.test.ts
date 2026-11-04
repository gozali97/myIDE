/* Licensed under the MIT License. */
import assert from 'assert';
import { upcastPartial } from '../../../../../../../base/test/common/mock.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { LineRange } from '../../../../../../../editor/common/core/ranges/lineRange.js';
import { DetailedLineRangeMapping } from '../../../../../../../editor/common/diff/rangeMapping.js';
import { IEditorWorkerService } from '../../../../../../../editor/common/services/editorWorker.js';
import { ITextModelService } from '../../../../../../../editor/common/services/resolverService.js';
import { GozappEditPreview } from '../../../../browser/widget/chatContentParts/gozappEditPreview.js';

suite('Gozapp edit preview DOM', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const original = URI.parse('test:original');
	const modified = URI.parse('test:modified');

	function create(addedOnly = false, missingSnapshot = false, removedEnd = 3, addedEnd = 30) {
		let released = 0;
		let resized = 0;
		const models = upcastPartial<ITextModelService>({
			async createModelReference() {
				if (missingSnapshot) { throw new Error('Missing snapshot'); }
				return {
					object: { textEditorModel: { getVersionId: () => 1, getValueLength: () => 100, getLineCount: () => 29, getLineContent: () => '<img src=x onerror=alert(1)>' } },
					dispose: () => { released++; },
				} as unknown as Awaited<ReturnType<ITextModelService['createModelReference']>>;
			},
		});
		const worker = upcastPartial<IEditorWorkerService>({
			async computeDiff() {
				return {
					identical: false, quitEarly: false, moves: [],
					changes: [new DetailedLineRangeMapping(new LineRange(1, addedOnly ? 1 : removedEnd), new LineRange(1, addedEnd), undefined)],
				};
			},
		});
		const preview = store.add(new GozappEditPreview(() => resized++, models, worker));
		return { preview, released: () => released, resized: () => resized };
	}

	test('renders bounded deleted/added rows as literal text with themed colors', async () => {
		const { preview, released, resized } = create();
		await preview.render(original, modified);
		assert.strictEqual(preview.element.hidden, false);
		assert.strictEqual(preview.element.children.length, 13);
		assert.match(preview.element.lastElementChild?.textContent ?? '', /Partial preview/);
		assert.ok(preview.element.children[0].textContent?.includes('−'));
		assert.ok(preview.element.children[2].textContent?.includes('+'));
		assert.strictEqual(preview.element.querySelector('img'), null);
		assert.ok((preview.element.children[0] as HTMLElement).style.backgroundColor.includes('removedTextBackground'));
		assert.ok((preview.element.children[2] as HTMLElement).style.backgroundColor.includes('insertedTextBackground'));
		assert.strictEqual(preview.element.getAttribute('role'), 'region');
		assert.strictEqual(preview.element.tabIndex, 0);
		assert.strictEqual(released(), 2);
		preview.clear();
		assert.strictEqual(preview.element.hidden, true);
		assert.strictEqual(preview.element.children.length, 0);
		assert.strictEqual(resized(), 2);
	});

	test('large replacement reserves half the preview for additions', async () => {
		const { preview } = create(false, false, 100);
		await preview.render(original, modified);
		const rows = Array.from(preview.element.querySelectorAll('.gozapp-edit-preview-line'));
		assert.strictEqual(rows.length, 12);
		assert.strictEqual(rows.filter(row => row.textContent?.includes('−')).length, 6);
		assert.strictEqual(rows.filter(row => row.textContent?.includes('+')).length, 6);
	});

	test('new file has only insertion rows', async () => {
		const { preview } = create(true);
		await preview.render(original, modified);
		assert.strictEqual(preview.element.children.length, 13);
		assert.ok(Array.from(preview.element.querySelectorAll('.gozapp-edit-preview-line')).every(row => row.textContent?.includes('+')));
	});

	test('external creation without a before snapshot uses after content only', async () => {
		const { preview, released } = create();
		await preview.render(undefined, modified);
		assert.strictEqual(preview.element.hidden, false);
		assert.strictEqual(preview.element.children.length, 13);
		assert.ok(Array.from(preview.element.querySelectorAll('.gozapp-edit-preview-line')).every(row => row.textContent?.includes('+')));
		assert.strictEqual(released(), 1);
	});

	test('external deletion without an after snapshot shows removed content', async () => {
		const { preview, released } = create();
		await preview.render(original, undefined);
		assert.strictEqual(preview.element.hidden, false);
		assert.strictEqual(preview.element.children.length, 13);
		assert.ok(Array.from(preview.element.querySelectorAll('.gozapp-edit-preview-line')).every(row => row.textContent?.includes('−')));
		assert.strictEqual(released(), 1);
	});

	test('no snapshots leaves preview hidden without loading models', async () => {
		const { preview, released } = create(false, true);
		await preview.render(undefined, undefined);
		assert.strictEqual(preview.element.hidden, true);
		assert.strictEqual(preview.element.children.length, 0);
		assert.strictEqual(released(), 0);
	});

	test('deletion-only changes use the full preview budget', async () => {
		const { preview } = create(false, false, 100, 1);
		await preview.render(original, modified);
		assert.strictEqual(preview.element.children.length, 13);
		assert.ok(Array.from(preview.element.querySelectorAll('.gozapp-edit-preview-line')).every(row => row.textContent?.includes('−')));
	});

	test('model changed during diff computation does not render stale line ranges', async () => {
		let version = 1;
		let releases = 0;
		let reads = 0;
		const models = upcastPartial<ITextModelService>({
			async createModelReference() {
				return {
					object: { textEditorModel: {
						getValueLength: () => 100, getVersionId: () => version,
						getLineContent: () => { reads++; return 'changed'; },
					} },
					dispose: () => releases++,
				} as unknown as Awaited<ReturnType<ITextModelService['createModelReference']>>;
			},
		});
		const worker = upcastPartial<IEditorWorkerService>({
			async computeDiff() {
				version++;
				return { identical: false, quitEarly: false, moves: [], changes: [new DetailedLineRangeMapping(new LineRange(1, 2), new LineRange(1, 2), undefined)] };
			},
		});
		const preview = store.add(new GozappEditPreview(() => {}, models, worker));
		await preview.render(original, modified);
		assert.strictEqual(preview.element.hidden, true);
		assert.strictEqual(reads, 0, 'Do not read changed content using stale line ranges');
		assert.strictEqual(releases, 2);
	});

	for (const content of ['', 'hello', 'hello\n', 'hello\n\n', '\n']) {
		for (const operation of ['create', 'delete']) {
			test(`${operation} newline accounting for ${JSON.stringify(content)}`, async () => {
				const lines = content.split('\n');
				const models = upcastPartial<ITextModelService>({
					async createModelReference() {
						return { object: { textEditorModel: {
							getValueLength: () => content.length, getVersionId: () => 1,
							getLineCount: () => lines.length, getLineContent: (line: number) => lines[line - 1],
						} }, dispose() {} } as unknown as Awaited<ReturnType<ITextModelService['createModelReference']>>;
					},
				});
				const worker = upcastPartial<IEditorWorkerService>({ computeDiff: async () => { throw new Error('One-sided preview must not run worker'); } });
				const preview = store.add(new GozappEditPreview(() => {}, models, worker));
				await preview.render(operation === 'delete' ? original : undefined, operation === 'create' ? modified : undefined);
				const expected = content === '' ? 0 : lines.length - (content.endsWith('\n') ? 1 : 0);
				assert.strictEqual(preview.element.children.length, expected);
				assert.strictEqual(preview.element.hidden, expected === 0);
			});
		}
	}

	test('missing snapshot leaves preview hidden without throwing', async () => {
		const { preview } = create(false, true);
		await preview.render(original, modified);
		assert.strictEqual(preview.element.hidden, true);
		assert.strictEqual(preview.element.children.length, 0);
	});
});
