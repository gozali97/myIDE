import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts', import.meta.url), 'utf8');
const start = source.indexOf('\t\tconst keepOpenForFocus =');
const end = source.indexOf('\n\t\tconst updateExpansionState', start);
assert.ok(start >= 0 && end > start);
class Element {
    constructor(pill, nested) { this.pill = pill; this.nested = nested; }
    contains() { return false; }
    matches() { return this.pill; }
    querySelector() { return this.nested; }
}
for (const nested of [false, true]) {
    for (const explicit of [undefined, true, false]) {
        for (const reducedMotion of [false, true]) {
            const details = {};
            const templateData = { completedResponseDisclosureOpen: explicit };
            const result = vm.runInNewContext(`(function () { ${source.slice(start, end)}; return shouldAnimateInitialCollapse; }).call(renderer)`, {
                HTMLElement: Element, details, templateData, focusedContent: undefined,
                nodesToCollapse: [new Element(!nested, nested)], animateCollapse: true,
                renderer: { accessibilityService: { isMotionReduced: () => reducedMotion } },
            });
            assert.equal(details.open, explicit ?? true, 'Edits stay open unless explicitly collapsed');
            assert.equal(result, false, 'Edit history must not animate closed');
        }
    }
}
console.log('Completed edit history: direct/nested cards stay open, manual collapse respected, no collapse animation with either motion preference');
