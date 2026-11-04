import assert from 'node:assert/strict';
import { consumeGozappProbe } from '../src/vs/workbench/contrib/chat/common/gozappModelProbe.ts';
let updates = 0;
async function* stream() {
    yield { type: 'thinking', value: 'not counted' };
    yield [{ type: 'text', value: '' }, { type: 'text', value: 'O' }];
    yield { type: 'text', value: 'K' };
}
assert.equal(await consumeGozappProbe({ stream: stream(), result: Promise.resolve() }, () => updates++), 2);
assert.equal(updates, 2);
async function* empty() {}
await assert.rejects(consumeGozappProbe({ stream: empty(), result: Promise.resolve() }, () => {}), /EMPTY_RESPONSE/);
async function* broken() { throw new Error('stream failed'); }
await assert.rejects(consumeGozappProbe({ stream: broken(), result: Promise.resolve() }, () => {}), /stream failed/);
await assert.rejects(consumeGozappProbe({ stream: stream(), result: Promise.reject(new Error('provider failed')) }, () => {}), /provider failed/);
console.log('Model probe checks passed');
