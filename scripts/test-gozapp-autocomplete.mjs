import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { allowedFile, prompt, clean, remaining, mapOffset } = require('../extensions/gozapp-autocomplete/context.js');
for (const file of ['/app/.env', '/app/.env.local', '/app/.ssh/config', '/app/private.pem', '/app/secrets/key.txt']) assert.equal(allowedFile(file), false);
assert.equal(allowedFile('/app/src/main.ts'), true);
const text = 'x'.repeat(20000);
const rendered = prompt(text, 10000, 'typescript');
const body = JSON.parse(rendered.split('\n\n').at(-1));
assert.equal(body.before.length, 10000);
assert.equal(body.after.length, 4000);
assert.match(rendered, /up to 8 lines/);
const large = 'IMPORTS' + 'x'.repeat(40000);
const context = JSON.parse(prompt(large, 25000, 'typescript').split('\n\n').at(-1));
assert.equal(context.fileHeader.length, 3000);
assert.ok(context.fileHeader.startsWith('IMPORTS'));
assert.equal(context.before.length, 12000);
assert.equal(context.after.length, 4000);
assert.equal(clean('```js\nx\n```'), 'x');
assert.equal(clean('```ts\n  return value;\n```'), '  return value;');
assert.equal(clean('Explanation\n```js\nx\n```'), '');
assert.equal(clean('```js\nx\n```\n```js\ny\n```'), '');
assert.equal(clean('x\n'.repeat(10)), '');
assert.equal(clean('x'.repeat(2001)), '');
assert.equal(clean('  return value;\n'), '  return value;');
assert.equal(remaining('func', 'tion demo() {}', 'funct'), 'ion demo() {}');
assert.equal(remaining('func', 'tion', 'function'), '');
assert.equal(remaining('func', 'tion', 'funcx'), undefined);
assert.equal(remaining('func', 'tion', 'fun'), undefined);
// Unrelated edits earlier in the file keep the suggestion; the local prefix still matches.
assert.equal(remaining('header\nfunc', 'tion', 'CHANGED header\nfunct'), 'ion');
// A rewritten local prefix must invalidate: the text right before the cursor no longer matches.
assert.equal(remaining('a'.repeat(300) + 'func', 'tion', 'b'.repeat(50) + 'func'), undefined);
assert.equal(remaining('x'.repeat(300) + 'func', 'tion', 'x'.repeat(300) + 'funct'), 'ion');
for (const [change, offset, expected] of [
    [{ rangeOffset: 0, rangeLength: 0, text: 'ab' }, 5, 7],
    [{ rangeOffset: 0, rangeLength: 2, text: '' }, 5, 3],
    [{ rangeOffset: 5, rangeLength: 0, text: 'x' }, 5, 6],
    [{ rangeOffset: 7, rangeLength: 3, text: 'y' }, 5, 5],
    [{ rangeOffset: 4, rangeLength: 3, text: 'z' }, 5, undefined],
]) {
    assert.equal(mapOffset(change, offset), expected);
}
console.log('Autocomplete context, guards, cursor mapping across edits and local-prefix suggestion reuse passed');
