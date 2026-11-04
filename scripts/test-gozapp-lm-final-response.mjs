import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../extensions/copilot/src/extension/conversation/vscode-node/languageModelAccess.ts', import.meta.url), 'utf8');
const start = source.indexOf('if (streamedCharacters === 0 && result.value)');
const end = source.indexOf("\n\t\tif (extensionId ===", start);
assert.ok(start > 0 && end > start);
const code = source.slice(start, end);
for (const [streamedCharacters, value, expected] of [[0, 'console.log(value);', ['console.log(value);']], [5, 'hello', []], [0, '', []]]) {
    const parts = [];
    await vm.runInNewContext(`(async () => { ${code} })()`, {
        streamedCharacters, result: { value },
        callback: async (text, index, delta) => { assert.equal(text, delta.text); assert.equal(index, 0); parts.push(delta.text); },
    });
    assert.deepEqual(parts, expected);
}
console.log('LM wrapper final-only text fallback: delivered once; streamed and empty responses unchanged');
