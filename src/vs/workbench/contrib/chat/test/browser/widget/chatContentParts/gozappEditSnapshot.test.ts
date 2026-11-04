/* Licensed under the MIT License. */
import assert from 'assert';
import { URI } from '../../../../../../../base/common/uri.js';
import { ChatExternalEditContentPart } from '../../../../browser/widget/chatContentParts/chatExternalEditContentPart.js';
import { CollapsedCodeBlock } from '../../../../browser/widget/chatContentParts/chatMarkdownContentPart.js';

suite('Gozapp edit history snapshot', () => {
	for (const kind of ['create', 'edit'] as const) {
		test(`external ${kind} opens its recorded after snapshot`, async () => {
			const snapshot = URI.parse('snapshot:external-after');
			let opened: { resource: URI } | undefined;
			await Reflect.apply(Reflect.get(ChatExternalEditContentPart.prototype, 'openEdit'), {
				edit: {
					uri: URI.parse('file:///workspace/result.ts'), editKind: kind,
					beforeContentUri: kind === 'edit' ? URI.parse('snapshot:empty') : undefined,
					afterContentUri: snapshot, diff: { added: 2, removed: 0 },
				},
				textModelService: { async createModelReference() { return { object: { textEditorModel: { getValueLength: () => 0 } }, dispose() {} }; } },
				editorService: { openEditor(input: typeof opened) { opened = input; } },
			}, [{ editorOptions: {}, openToSide: false }]);
			assert.strictEqual(opened?.resource, snapshot);
		});
	}

	test('deleted file opens the before snapshot instead of a missing working file', async () => {
		const originalURI = URI.parse('snapshot:deleted-before');
		const options = { pinned: true };
		let opened: { resource: URI; options: unknown } | undefined;
		await Reflect.apply(Reflect.get(CollapsedCodeBlock.prototype, 'showDiff'), {
			currentDiff: { originalURI, modifiedURI: URI.parse('file:///workspace/deleted.ts'), isDeleted: true, removed: 10 },
			editorService: { openEditor(input: typeof opened) { opened = input; } },
		}, [{ editorOptions: options, openToSide: false }]);
		assert.strictEqual(opened?.resource, originalURI);
		assert.strictEqual(opened?.options, options);
	});

	for (const frozen of [true, false]) {
		test(`new file review opens the frozen result when available (frozen=${frozen})`, async () => {
			const uri = URI.parse('file:///workspace/new.ts');
			const snapshot = frozen ? URI.parse('snapshot:created') : undefined;
			let opened: { resource: URI } | undefined;
			let released = 0;
			await Reflect.apply(Reflect.get(CollapsedCodeBlock.prototype, 'showDiff'), {
				uri,
				currentDiff: { originalURI: URI.parse('snapshot:empty'), modifiedURI: uri, modifiedSnapshotURI: snapshot, removed: 0 },
				textModelService: { async createModelReference() { return { object: { textEditorModel: { getValueLength: () => 0 } }, dispose() { released++; } }; } },
				editorService: { openEditor(input: typeof opened) { opened = input; } },
			}, [{ editorOptions: {}, openToSide: false }]);
			assert.strictEqual(opened?.resource, snapshot ?? uri);
			assert.strictEqual(released, 1);
		});
		test(`full review prefers the same snapshot as preview (frozen=${frozen})`, async () => {
			const originalURI = URI.parse('snapshot:before');
			const modifiedURI = URI.parse('file:///workspace/file.ts');
			const modifiedSnapshotURI = frozen ? URI.parse('snapshot:after-turn') : undefined;
			let opened: { original: { resource: URI }; modified: { resource: URI } } | undefined;
			// Exercise the actual click handler without requiring a live editing session.
			await Reflect.apply(Reflect.get(CollapsedCodeBlock.prototype, 'showDiff'), {
				currentDiff: { originalURI, modifiedURI, modifiedSnapshotURI, removed: 1 },
				editorService: { openEditor(input: typeof opened) { opened = input; } },
			}, [{ editorOptions: {}, openToSide: false }]);
			assert.strictEqual(opened?.original.resource, originalURI);
			assert.strictEqual(opened?.modified.resource, modifiedSnapshotURI ?? modifiedURI);
		});
	}
});
