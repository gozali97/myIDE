import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let source = readFileSync(new URL('../out/vs/workbench/contrib/chat/browser/widget/chatContentParts/gozappEditPreview.js', import.meta.url), 'utf8');
source = source.replace(/^import .*;$/gm, '').replace(/export \{[\s\S]*?\};/g, '');
const node = () => ({ style: {}, hidden: false, setAttribute() {}, append(row) { this.rows.push(row); }, rows: [], replaceChildren(fragment) { this.rows = fragment?.rows ?? []; } });
class Disposable { _store = { isDisposed: false }; dispose() { this._store.isDisposed = true; } }
let disposed = 0;
class DisposableStore { refs = []; add(ref) { this.refs.push(ref); return ref; } dispose() { this.refs.forEach(ref => ref.dispose()); } }
const service = () => () => {};
const context = vm.createContext({ dom: { $: node }, Disposable, DisposableStore, ITextModelService: service(), IEditorWorkerService: service(), localize: (_key, value) => value, document: { createDocumentFragment: node } });
vm.runInContext(source + '\nglobalThis.Preview = GozappEditPreview;', context);
let height = 0;
let calls = 0;
const model = { getVersionId: () => 1, getValueLength: () => 50, getLineContent: () => '<script>not HTML</script>' };
const models = { async createModelReference() { return { object: { textEditorModel: model }, dispose() { disposed++; } }; } };
const worker = { async computeDiff() { calls++; return { changes: [{ original: { startLineNumber: 1, endLineNumberExclusive: 3 }, modified: { startLineNumber: 1, endLineNumberExclusive: 30 } }] }; } };
const preview = new context.Preview(() => height++, models, worker);
await preview.render({}, {});
assert.equal(preview.element.rows.length, 13);
assert.match(preview.element.rows[12].textContent, /Partial preview/);
assert.match(preview.element.rows[0].textContent, /−.*<script>/);
assert.match(preview.element.rows[2].textContent, /\+/);
assert.equal(height, 1);
assert.equal(disposed, 2);
worker.computeDiff = async () => ({ changes: [{ original: { startLineNumber: 1, endLineNumberExclusive: 1 }, modified: { startLineNumber: 1, endLineNumberExclusive: 4 } }] });
await preview.render({}, {});
assert.equal(preview.element.rows.length, 3, 'New file shows insertion-only preview');
assert.ok(preview.element.rows.every(row => row.textContent.includes('+')));
model.getValueLength = () => 500001;
await preview.render({}, {});
assert.equal(calls, 1, 'Large files skip diff computation');
assert.equal(preview.element.hidden, true, 'Skipped preview must not retain stale rows');
assert.equal(disposed, 6);
await new context.Preview(() => {}, { async createModelReference() { throw Error('Missing snapshot'); } }, worker).render({}, {});
// Invalidate a render while its second model is loading: no worker job may start.
model.getValueLength = () => 50;
for (const action of ['clear', 'dispose']) {
    let finishLoad;
    let loads = 0;
    let releases = 0;
    let computations = 0;
    const ref = () => ({ object: { textEditorModel: model }, dispose() { releases++; } });
    const race = new context.Preview(() => {}, {
        createModelReference() {
            loads++;
            return loads === 1 ? Promise.resolve(ref()) : new Promise(resolve => { finishLoad = resolve; });
        },
    }, { async computeDiff() { computations++; return null; } });
    const pending = race.render({}, {});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(loads, 2);
    race[action]();
    finishLoad(ref());
    await pending;
    assert.equal(computations, 0, `${action}: stale render must not compute diff`);
    assert.equal(releases, 2, `${action}: both references must be released`);
    assert.equal(race.element.hidden, true);
    if (action === 'dispose') {
        await race.render({}, {});
        assert.equal(loads, 2, 'Disposed preview must not load models again');
    }
}
let resizeEvents = 0;
const resized = new context.Preview(() => resizeEvents++, models, worker);
await resized.render({}, {});
assert.equal(resized.element.hidden, false);
const beforeClear = resizeEvents;
resized.clear();
assert.equal(resizeEvents, beforeClear + 1, 'Removing visible preview must notify chat layout');
resized.clear();
assert.equal(resizeEvents, beforeClear + 1, 'Clearing hidden preview must not relayout');
const markdown = readFileSync(new URL('../src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatMarkdownContentPart.ts', import.meta.url), 'utf8');
const diffHandler = markdown.slice(markdown.indexOf('// Render the +/- diff'));
assert.ok(diffHandler.indexOf('this.previewScheduler.schedule()') < diffHandler.indexOf('if (changes.isFinal)'), 'Preview must be scheduled before finalization');
assert.match(markdown, /onDidChangePreviewHeight\(\(\) => this\._onDidChangeHeight\.fire\(\)\)/);
const external = readFileSync(new URL('../src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatExternalEditContentPart.ts', import.meta.url), 'utf8');
assert.match(external, /preview\.render\(edit\.beforeContentUri, edit\.afterContentUri\)/);
console.log('Edit preview: bounded rendering, cleanup, failure guards and source wiring checks for non-final/external diffs passed');
