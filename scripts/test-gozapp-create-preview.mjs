import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../extensions/copilot/src/extension/tools/node/createFileTool.tsx', import.meta.url), 'utf8');
const start = source.indexOf("this._promptContext.stream.markdown('\\n```\\n');");
const end = source.indexOf('\n\t\t\tthis.sendTelemetry', start);
assert.ok(start >= 0 && end > start);
for (const stale of [false, true]) {
    const events = [];
    const uri = {};
    const stream = {
        markdown: text => events.push(['markdown', text]),
        codeblockUri: (...args) => events.push(['card', ...args]),
        textEdit: (...args) => events.push(['edit', ...args]),
    };
    const context = { stream };
    vm.runInNewContext(`(function () { ${source.slice(start, end)} }).call({ _promptContext: context })`, {
        context, uri, content: 'new file content', fileExists: false,
        doc: stale ? { getText: () => 'stale', lineCount: 1, lineAt: () => ({ text: 'stale' }) } : undefined,
        TextEdit: { insert: (_pos, text) => ({ text }), replace: (_range, text) => ({ text }) },
        ExtPosition: class {}, ExtRange: class {},
    });
    assert.deepEqual(events.map(event => event[0]), ['markdown', 'card', 'edit', 'edit', 'markdown']);
    assert.deepEqual(events[1], ['card', uri, true]);
    assert.equal(events[2][2].text, 'new file content');
    assert.deepEqual(events[3], ['edit', uri, true]);
    assert.equal(events[0][1], '\n```\n');
    assert.equal(events[4][1], '\n```\n');
}
console.log('Create preview stream: tracked card wraps insert and stale-buffer replacement; completion and balanced fences passed');
