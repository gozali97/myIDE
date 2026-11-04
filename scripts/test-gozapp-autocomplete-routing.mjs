import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('../extensions/copilot/src/extension/', import.meta.url);
const source = readFileSync(new URL('completions-core/vscode-node/lib/src/openai/fetch.ts', root), 'utf8');
const start = source.indexOf("\t\tconst resource = window.activeTextEditor?.document.uri;");
const end = source.indexOf('\n\t\tif (this.#disabledReason)', start);
assert.ok(start > 0 && end > start);
const body = source.slice(start, end).replaceAll('<boolean>', '').replaceAll('<string>', '').replace('const choice: APIChoice', 'const choice');
for (const enabled of [true, false]) {
    for (const fail of [true, false]) {
        let providerCalls = 0, nativeCalls = 0, callbackCalls = 0;
        const result = await vm.runInNewContext(`(async () => { ${body}; native(); return 'native'; })()`, {
            window: { activeTextEditor: { document: { uri: 'file:test' } } },
            logger: { info() {} }, logTargetService: {},
            workspace: { getConfiguration: () => ({ get: () => enabled }) },
            commands: { executeCommand: async (id) => { providerCalls++; assert.equal(id, 'gozapp.autocomplete.completeNative'); if (fail) throw Error(); return 'answer'; } },
            params: { prompt: { prefix: 'con', suffix: '' }, languageId: 'javascript', ourRequestId: 'id' },
            cancel: undefined, baseTelemetryData: {}, generateUuid: () => 'uuid', native: () => nativeCalls++,
            finishedCb: (text, delta) => { callbackCalls++; assert.equal(text, 'answer'); assert.equal(delta.text, text); assert.equal(delta.finished, true); return 3; },
        });
        assert.equal(nativeCalls, enabled ? 0 : 1);
        assert.equal(providerCalls, enabled ? 1 : 0);
        assert.equal(callbackCalls, enabled && !fail ? 1 : 0, 'Native async matcher must receive the completion callback');
        if (enabled && !fail) { const choices = []; for await (const choice of result.choices) choices.push(choice.completionText); assert.deepEqual(choices, ['ans']); }
        if (enabled && fail) assert.equal(result.type, 'failed');
    }
}
const nes = readFileSync(new URL('inlineEdits/vscode-node/inlineCompletionProvider.ts', root), 'utf8');
assert.match(nes, /getConfiguration\('gozapp.autocomplete', document.uri\).*return undefined/);
const inline = readFileSync(new URL('completions-core/vscode-node/lib/src/inlineCompletion.ts', root), 'utf8');
assert.match(inline, /resultType !== ResultType.TypingAsSuggested && !workspace.getConfiguration\('gozapp.autocomplete'/, 'BYOK must not schedule speculative requests');
console.log('Native fetch adapter: BYOK success/failure cannot reach Copilot transport; Off preserves upstream; NES suppressed');
