import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { GOZAPP_DEVELOPER_INSTRUCTIONS } from '../src/vs/workbench/contrib/chat/common/gozappDeveloperInstructions.ts';
const source = readFileSync(new URL('../src/vs/workbench/contrib/chat/browser/chatManagement/gozappSettings.ts', import.meta.url), 'utf8');
const start = source.indexOf("\t\tthis.button(this.content, 'Review latest Senior instructions template'");
const end = source.indexOf("\n\t\tthis.button(this.content, 'Agent Settings'", start);
assert.ok(start >= 0 && end > start);
for (const result of ['opened', 'unavailable', 'error']) {
    let callback;
    let input;
    let fileAccess = 0;
    const status = { textContent: '' };
    const page = {
        button(_container, _label, action) { callback = action; },
        editors: { async openEditor(value) {
            input = value;
            if (result === 'error') { throw new Error('Failed'); }
            return result === 'opened' ? {} : undefined;
        } },
        get files() { fileAccess++; throw new Error('Preview must not access profile files'); },
    };
    vm.runInNewContext(`(function () { ${source.slice(start, end)} }).call(page)`, { page, status, GOZAPP_DEVELOPER_INSTRUCTIONS });
    await callback();
    assert.equal(input.resource, undefined);
    assert.equal(input.contents, GOZAPP_DEVELOPER_INSTRUCTIONS);
    assert.equal(input.languageId, 'markdown');
    assert.equal(fileAccess, 0);
    assert.match(status.textContent, result === 'opened' ? /not activated/ : /not changed/);
}
console.log('Senior template preview: unsaved content, no profile writes, open failure handling passed');
