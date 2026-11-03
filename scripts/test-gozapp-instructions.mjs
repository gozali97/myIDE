import assert from 'node:assert/strict';
import { GOZAPP_PONYTAIL_INSTRUCTIONS } from '../src/vs/workbench/contrib/chat/common/gozappPonytailInstructions.ts';
import { GOZAPP_DEVELOPER_INSTRUCTIONS } from '../src/vs/workbench/contrib/chat/common/gozappDeveloperInstructions.ts';
for (const text of [GOZAPP_PONYTAIL_INSTRUCTIONS, GOZAPP_DEVELOPER_INSTRUCTIONS]) {
    assert.ok(text.startsWith('---\napplyTo: "**"\n---\n'));
    assert.match(text, /last resort/);
    assert.match(text, /permission/);
    assert.match(text, /current (file|target)/);
}
assert.match(GOZAPP_PONYTAIL_INSTRUCTIONS, /DietrichGebert\/ponytail/);
assert.match(GOZAPP_PONYTAIL_INSTRUCTIONS, /savings are not guaranteed/);
console.log('Instruction format and edit-recovery safeguards passed');
