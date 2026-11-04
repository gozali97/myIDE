import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { getGozappActivityAge } from '../src/vs/workbench/contrib/chat/common/gozappActivity.ts';

// Exercise the actual activity block without booting the workbench or calling a provider.
const source = readFileSync(new URL('../src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatProgressContentPart.ts', import.meta.url), 'utf8');
assert.match(source, /if \(!this\.workingLogo && isResponseVM\(context\.element\)\) \{\s*const activity/, 'Native working footer must not get a duplicate activity indicator');
const start = source.indexOf('const activity = this.domNode;');
const end = source.indexOf('\n\t\t\trefresh();', start) + '\n\t\t\trefresh();'.length;
assert.ok(start >= 0 && end > start);
let now = 0;
let writes = 0;
let listener;
let tick;
let stopped = false;
const disposables = [];
const activity = { textContent: 'Working', set title(value) { writes++; this.text = value; } };
const part = { domNode: activity, responseComplete: false, _register(disposable) { disposables.push(disposable); } };
vm.runInNewContext(`(function () { ${source.slice(start, end)} }).call(part)`, {
    part, append: () => activity, $: () => null,
    context: { element: { model: { onDidChange(callback) { listener = callback; return {}; } } } },
    Date: { now: () => now }, getGozappActivityAge,
    localize: (_key, message, seconds) => message.replace('{0}', seconds),
    setInterval(callback) { tick = callback; return 1; },
    clearInterval() { stopped = true; }, toDisposable: dispose => ({ dispose }),
});
assert.equal(writes, 1);
for (let i = 0; i < 10000; i++) { listener(); }
assert.equal(writes, 1, 'Identical streaming updates must not rewrite the DOM');
now = 30000;
tick();
assert.equal(writes, 2);
assert.match(activity.text, /No response updates/);
listener();
assert.equal(writes, 3, 'New response activity immediately clears the quiet warning');
assert.match(activity.text, /0s ago/);
part.responseComplete = true;
tick();
assert.equal(stopped, true);
assert.equal(activity.text, '');
assert.equal(activity.textContent, 'Working', 'Activity tooltip must not change native progress text');
assert.equal(writes, 4);
for (const disposable of disposables) { disposable.dispose?.(); }
console.log('Activity render: 10,000 same-second events -> 1 tooltip write; quiet/reset and completion cleanup passed');
