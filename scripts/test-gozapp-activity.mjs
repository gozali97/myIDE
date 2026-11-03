import assert from 'node:assert/strict';
import { getGozappActivityAge } from '../src/vs/workbench/contrib/chat/common/gozappActivity.ts';
assert.deepEqual(getGozappActivityAge(1000, 1000), { seconds: 0, quiet: false });
assert.deepEqual(getGozappActivityAge(30999, 1000), { seconds: 29, quiet: false });
assert.deepEqual(getGozappActivityAge(31000, 1000), { seconds: 30, quiet: true });
assert.deepEqual(getGozappActivityAge(32000, 32000), { seconds: 0, quiet: false });
assert.deepEqual(getGozappActivityAge(0, 1000), { seconds: 0, quiet: false });
console.log('Activity age checks passed');
