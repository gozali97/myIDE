/* Licensed under the MIT License. */
import assert from 'assert';
import { URI } from '../../../../../../../base/common/uri.js';
import { ChatExternalEditContentPart } from '../../../../browser/widget/chatContentParts/chatExternalEditContentPart.js';
import { IChatExternalEdit } from '../../../../common/chatService/chatService.js';

suite('External edit card identity', () => {
	const edit: IChatExternalEdit = {
		kind: 'externalEdit', editKind: 'edit', uri: URI.parse('file:///project/file.ts'),
		beforeContentUri: URI.parse('snapshot:before'), afterContentUri: URI.parse('snapshot:after'),
		undoStopId: 'stop-1', diff: { added: 2, removed: 2 },
	};
	function same(other: IChatExternalEdit): boolean {
		// Identity check is pure; no DOM or editor services are needed.
		return Reflect.apply(ChatExternalEditContentPart.prototype.hasSameContent, { edit }, [other, [], undefined]);
	}
	test('equivalent URI instances reuse the existing card', () => {
		assert.strictEqual(same({ ...edit, beforeContentUri: URI.parse('snapshot:before'), afterContentUri: URI.parse('snapshot:after') }), true);
	});
	test('new snapshot invalidates the card even when line counts are unchanged', () => {
		assert.strictEqual(same({ ...edit, beforeContentUri: URI.parse('snapshot:new-before') }), false);
		assert.strictEqual(same({ ...edit, afterContentUri: URI.parse('snapshot:new-after') }), false);
	});
	test('removed snapshot and different undo stop invalidate the card', () => {
		assert.strictEqual(same({ ...edit, beforeContentUri: undefined }), false);
		assert.strictEqual(same({ ...edit, afterContentUri: undefined }), false);
		assert.strictEqual(same({ ...edit, undoStopId: 'stop-2' }), false);
	});
	test('rename source changes invalidate the card, equivalent sources reuse it', () => {
		const rename: IChatExternalEdit = { ...edit, editKind: 'rename', originalUri: URI.parse('file:///project/old.ts') };
		const compare = (other: IChatExternalEdit) => Reflect.apply(ChatExternalEditContentPart.prototype.hasSameContent, { edit: rename }, [other, [], undefined]);
		assert.strictEqual(compare({ ...rename, originalUri: URI.parse('file:///project/old.ts') }), true);
		assert.strictEqual(compare({ ...rename, originalUri: URI.parse('file:///project/different.ts') }), false);
		assert.strictEqual(compare({ ...rename, originalUri: undefined }), false);
	});

	test('changed stats and ownership still invalidate the card', () => {
		assert.strictEqual(same({ ...edit, diff: { added: 3, removed: 2 } }), false);
		assert.strictEqual(same({ ...edit, subAgentInvocationId: 'another-agent' }), false);
	});
});
