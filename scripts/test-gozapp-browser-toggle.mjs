import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/vs/workbench/contrib/chat/browser/chatManagement/gozappSettings.ts', import.meta.url), 'utf8');
const start = source.indexOf("const browserToolsKey = 'workbench.browser.enableChatTools';");
const end = source.indexOf("\n\t\tDOM.append(this.content, DOM.$('p', undefined, 'Off disables", start);
assert.ok(start >= 0 && end > start);
const block = source.slice(start, end).replaceAll('<HTMLSelectElement>', '').replaceAll('<boolean>', '');
for (const mode of ['success', 'override', 'failure']) {
    let value = true;
    let changed;
    let click;
    let select;
    let update;
    const status = {};
    const page = { content: {}, page: { add() {} }, configuration: {
        getValue: () => value,
        onDidChangeConfiguration(callback) { changed = callback; },
        async updateValue(...args) { update = args; if (mode === 'failure') { throw Error('save failed'); } if (mode !== 'override') { value = args[1]; } },
    } };
    const DOM = {
        $(tag) { const node = {}; if (tag === 'select') { select = node; } return node; },
        append(_parent, node) { return node; },
        addDisposableListener(_node, _event, callback) { click = callback; },
    };
    vm.runInNewContext(`(function () { ${block} }).call(page)`, { page, DOM, status, ConfigurationTarget: { USER: 2 } });
    assert.equal(select.value, 'true');
    select.value = 'false';
    await click();
    assert.equal(update[0], 'workbench.browser.enableChatTools');
    assert.equal(update[1], false);
    assert.equal(update[2], 2);
    assert.equal(select.disabled, false);
    assert.equal(select.value, mode === 'success' ? 'false' : 'true');
    assert.match(status.textContent, mode === 'success' ? /saved/ : mode === 'override' ? /overrides/ : /Unable/);
    value = false;
    changed({ affectsConfiguration: key => key === 'workbench.browser.enableChatTools' });
    assert.equal(select.value, 'false');
}
console.log('Browser toggle: initial state, save, override, failure recovery and config synchronization passed');
