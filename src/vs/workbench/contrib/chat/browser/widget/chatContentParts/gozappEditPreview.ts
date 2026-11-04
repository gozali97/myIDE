/* Licensed under the MIT License. */
import * as dom from '../../../../../../base/browser/dom.js';
import { Disposable, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../../base/common/uri.js';
import { IEditorWorkerService } from '../../../../../../editor/common/services/editorWorker.js';
import { ITextModelService } from '../../../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../../../nls.js';

/** Small read-only preview; the existing file header still opens the full review editor. */
export class GozappEditPreview extends Disposable {
	readonly element = dom.$('div.gozapp-edit-preview');
	private generation = 0;

	constructor(
		private readonly changed: () => void,
		@ITextModelService private readonly models: ITextModelService,
		@IEditorWorkerService private readonly worker: IEditorWorkerService,
	) {
		super();
		this.element.hidden = true;
		this.element.style.cssText = 'width:100%;max-height:180px;overflow:auto;font-family:var(--monaco-monospace-font);font-size:12px;white-space:pre;border:1px solid var(--vscode-widget-border);border-radius:6px;margin-top:6px;';
		this.element.tabIndex = 0;
		this.element.setAttribute('role', 'region');
		this.element.setAttribute('aria-label', localize('gozapp.editPreview', 'Edit preview; open the file header for full review'));
	}

	clear(): void {
		this.generation++;
		this.element.replaceChildren();
		const wasVisible = !this.element.hidden;
		this.element.hidden = true;
		if (wasVisible) { this.changed(); }
	}

	async render(original: URI | undefined, modified: URI | undefined): Promise<void> {
		if (this._store.isDisposed) { return; }
		this.clear();
		if (!original && !modified) { return; }
		const generation = this.generation;
		const refs = new DisposableStore();
		try {
			const before = original ? refs.add(await this.models.createModelReference(original)).object.textEditorModel : undefined;
			if (this._store.isDisposed || generation !== this.generation) { return; }
			const after = modified ? refs.add(await this.models.createModelReference(modified)).object.textEditorModel : undefined;
			if (this._store.isDisposed || generation !== this.generation) { return; }
			// Avoid loading a heavy inline editor or diffing very large files for a preview.
			if ((before?.getValueLength() ?? 0) > 500000 || (after?.getValueLength() ?? 0) > 500000) { return; }
			const beforeVersion = before?.getVersionId();
			const afterVersion = after?.getVersionId();
			// Known creations/deletions need no diff worker or synthetic empty model.
			const diff = original && modified
				? await this.worker.computeDiff(original, modified, { ignoreTrimWhitespace: false, maxComputationTimeMs: 200, computeMoves: false }, 'advanced')
				: { quitEarly: false, changes: [{
					original: { startLineNumber: 1, endLineNumberExclusive: before && before.getValueLength() > 0 ? before.getLineCount() + (before.getLineContent(before.getLineCount()) === '' ? 0 : 1) : 1 },
					modified: { startLineNumber: 1, endLineNumberExclusive: after && after.getValueLength() > 0 ? after.getLineCount() + (after.getLineContent(after.getLineCount()) === '' ? 0 : 1) : 1 },
				}] };
			if (this._store.isDisposed || generation !== this.generation || !diff || diff.quitEarly) { return; }
			// Diff line ranges are only valid for the model versions the worker received.
			if (before?.getVersionId() !== beforeVersion || after?.getVersionId() !== afterVersion) { return; }
			const fragment = document.createDocumentFragment();
			let count = 0;
			let clippedText = false;
			const totalLines = diff.changes.reduce((total, change) => total
				+ change.original.endLineNumberExclusive - change.original.startLineNumber
				+ change.modified.endLineNumberExclusive - change.modified.startLineNumber, 0);
			for (const change of diff.changes) {
				for (const [range, model, sign, color] of [
					[change.original, before, '−', 'diffEditor.removedTextBackground'],
					[change.modified, after, '+', 'diffEditor.insertedTextBackground'],
				] as const) {
					if (!model) { continue; }
					// Reserve room for the added side of a large replacement, not just deleted lines.
					const limit = sign === '−'
						? 12 - Math.min(6, change.modified.endLineNumberExclusive - change.modified.startLineNumber)
						: 12;
					for (let line = range.startLineNumber; line < range.endLineNumberExclusive && count < limit; line++, count++) {
						const row = dom.$('div.gozapp-edit-preview-line');
						row.style.backgroundColor = `var(--vscode-${color.replace('.', '-')})`;
						const text = model.getLineContent(line);
						clippedText ||= text.length > 500;
						row.textContent = `${line} ${sign}  ${text.slice(0, 500)}`;
						fragment.append(row);
					}
				}
				if (count >= 12) { break; }
			}
			if (count < totalLines || clippedText) {
				const notice = dom.$('div.gozapp-edit-preview-notice');
				notice.style.cssText = 'white-space:normal;padding:4px 8px;color:var(--vscode-descriptionForeground);';
				notice.textContent = localize('gozapp.editPreview.truncated', 'Partial preview — open the file header for full review.');
				fragment.append(notice);
			}
			this.element.replaceChildren(fragment);
			this.element.hidden = count === 0;
			this.changed();
		} catch {
			// Snapshot unavailable: leave the existing file header and full-review action intact.
		} finally { refs.dispose(); }
	}
}
