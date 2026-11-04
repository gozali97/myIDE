import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../extensions/copilot/src/extension/completions-core/vscode-node/lib/src/ghostText/ghostText.ts', import.meta.url), 'utf8');
const start = source.indexOf('void requestPromise.then(result => {');
const end = source.indexOf('\n\t\t\t\t\tvoid this.asyncCompletionManager', start);
assert.ok(start > 0 && end > start);
const code = source.slice(start, end).replaceAll('<boolean>', '').replaceAll('<string>', '');
for (const scenario of ['same', 'version', 'cursor', 'editor', 'model', 'off', 'notCancelled', 'failed']) {
    let calls = 0;
    const editor = { document: { version: scenario === 'version' ? 2 : 1, uri: 'file:test' }, selection: { isEmpty: true, active: 'cursor' } };
    vm.runInNewContext(code, {
        requestPromise: Promise.resolve({ type: scenario === 'failed' ? 'failed' : 'success' }),
        cancellationToken: { isCancellationRequested: scenario !== 'notCancelled' },
        editor, window: { activeTextEditor: scenario === 'editor' ? {} : editor },
        refreshVersion: 1, refreshPosition: { isEqual: () => scenario !== 'cursor' }, refreshModel: 'model',
        workspace: { getConfiguration: () => ({ get: key => key === 'enabled' ? scenario !== 'off' : scenario === 'model' ? 'other' : 'model' }) },
        commands: { executeCommand: async (id, options) => { assert.equal(id, 'editor.action.inlineSuggest.trigger'); assert.equal(options.explicit, false); calls++; } },
        setTimeout: callback => callback(),
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, scenario === 'same' ? 1 : 0, scenario);
}
console.log('Late native completion refresh: unchanged editor only; cursor/version/model/cancellation guards passed');
