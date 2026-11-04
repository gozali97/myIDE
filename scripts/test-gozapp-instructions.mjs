import assert from 'node:assert/strict';
import { GOZAPP_DEBUG_PROMPT } from '../src/vs/workbench/contrib/chat/common/gozappDebugPrompt.ts';
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
assert.match(GOZAPP_DEBUG_PROMPT, /^---\nname: gozapp-debug\n/);
assert.match(GOZAPP_DEBUG_PROMPT, /\nagent: agent\n---\n/);
assert.match(GOZAPP_DEBUG_PROMPT, /Never log API keys/);
assert.match(GOZAPP_DEBUG_PROMPT, /Remove only temporary instrumentation/);
assert.match(GOZAPP_DEBUG_PROMPT, /does not enforce permissions/);
for (const requirement of [
    /observable acceptance criteria/,
    /do not add planning overhead/,
    /Search symbols and filenames first/,
    /reread after edits, failures or external changes/,
    /independent read-only searches or checks in parallel/,
    /dependent operations sequential/,
    /inspect the current diff and completed tool results/,
    /Do not automatically retry paid model requests/,
    /narrowest relevant test first/,
    /mark it unverified\/blocked/,
]) {
    assert.match(GOZAPP_DEVELOPER_INSTRUCTIONS, requirement);
}
console.log('Instruction format, target-driven workflow, context reuse, timeout and edit-recovery safeguards passed');
