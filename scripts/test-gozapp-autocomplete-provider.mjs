import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../extensions/gozapp-autocomplete/extension.js', import.meta.url), 'utf8');
const handlers = new Map();
let enabled = true, trusted = true, requests = 0, output = 'console.log(value);';
const editor = { document: { uri: { scheme: 'file', fsPath: '/tmp/example.js' }, version: 1, getText: () => 'con' } };
const vscode = {
    window: { activeTextEditor: editor, createOutputChannel: () => ({ info() {}, warn() {} }) },
    workspace: { get isTrusted() { return trusted; }, getConfiguration: () => ({ get: key => ({ enabled, model: 'customendpoint/test', delay: 2000 })[key] }) },
    commands: { registerCommand: (id, callback) => { handlers.set(id, callback); return { dispose() {} }; } },
    CancellationTokenSource: class { token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) }; cancel() { this.token.isCancellationRequested = true; } dispose() {} },
    LanguageModelChatMessage: { User: text => text },
    lm: { selectChatModels: async () => [{ vendor: 'customendpoint', id: 'test', async sendRequest(messages) {
        requests++; assert.equal(JSON.parse(messages[0].split('\n\n').at(-1)).before, 'con');
        return { text: (async function* () { yield output; })() };
    } }] },
};
const exports = {};
vm.runInNewContext(source, { exports, require: name => name === 'vscode' ? vscode : require('../extensions/gozapp-autocomplete/context.js'),
    setTimeout: (callback, ms) => { if (ms <= 10000) queueMicrotask(callback); return 1; }, clearTimeout() {},
});
exports.activate({ subscriptions: [] });
assert.equal(handlers.size, 2);
const complete = handlers.get('gozapp.autocomplete.completeNative');
const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) };
assert.equal(await complete('con', '', 'javascript', token), output);
assert.equal(requests, 1);
enabled = false; assert.equal(await complete('con', '', 'javascript', token), '');
enabled = true; trusted = false; assert.equal(await complete('con', '', 'javascript', token), '');
trusted = true; assert.equal(await complete('con', '', 'javascript', { ...token, isCancellationRequested: true }), '');
assert.equal(requests, 1, 'Blocked requests must not call a provider');
output = ''; assert.equal(await complete('con', '', 'javascript', token), '');
assert.equal(requests, 2);
console.log('Native BYOK command: response, empty output, cancellation and trust/config guards passed without network');
