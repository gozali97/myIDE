'use strict';
const vscode = require('vscode');
const { allowedFile, prompt, clean } = require('./context');
exports.activate = context => {
    const output = vscode.window.createOutputChannel('Gozapp Autocomplete', { log: true });
    context.subscriptions.push(output);
    output.info('Native Copilot autocomplete with BYOK transport enabled when configured. No separate inline provider.');
    context.subscriptions.push(vscode.commands.registerCommand('gozapp.autocomplete.selectModel', async () => {
        try {
            const models = await vscode.lm.selectChatModels();
            const selected = await vscode.window.showQuickPick(models.map(model => ({ label: model.name, description: model.vendor, detail: model.id, model })), { title: 'Autocomplete provider / model (uses existing API credentials)' });
            if (!selected) return;
            const consent = await vscode.window.showWarningMessage('Enable native AI autocomplete with your provider? Up to 19,000 characters around the cursor will be sent after typing pauses. Requests may incur charges. Sensitive filenames are excluded, but ordinary source files can still contain secrets.', { modal: true }, 'Enable');
            if (consent !== 'Enable') return;
            const config = vscode.workspace.getConfiguration('gozapp.autocomplete');
            await config.update('model', selected.model.id, vscode.ConfigurationTarget.Global);
            await config.update('enabled', true, vscode.ConfigurationTarget.Global);
        } catch { vscode.window.showErrorMessage('Unable to configure autocomplete. Check model registration and permissions.'); }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gozapp.autocomplete.completeNative', async (prefix, suffix, language, token) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !vscode.workspace.isTrusted || editor.document.uri.scheme !== 'file' || !allowedFile(editor.document.uri.fsPath)) return '';
        const document = editor.document;
        const version = document.version;
        const config = vscode.workspace.getConfiguration('gozapp.autocomplete', document.uri);
        if (!config.get('enabled') || typeof prefix !== 'string' || typeof suffix !== 'string' || document.getText().length > 500000) return '';
        const cts = new vscode.CancellationTokenSource();
        const cancellation = token?.onCancellationRequested(() => cts.cancel());
        let timer;
        try {
            const delay = Math.min(10000, Math.max(2000, Number(config.get('delay', 2000)) || 2000));
            // Native cache hits bypass this command; only new network requests wait for quiet text.
            await new Promise(resolve => {
                timer = setTimeout(resolve, delay);
                cts.token.onCancellationRequested(resolve);
            });
            if (token?.isCancellationRequested || cts.token.isCancellationRequested || document.version !== version || vscode.window.activeTextEditor?.document !== document) return '';
            const models = await vscode.lm.selectChatModels({ id: config.get('model') });
            if (!models.length) { output.warn('Selected autocomplete model is unavailable; no Copilot fallback.'); return ''; }
            timer = setTimeout(() => cts.cancel(), 30000);
            output.info(`Native completion dispatch via ${models[0].vendor} / ${models[0].id}`);
            const response = await models[0].sendRequest([vscode.LanguageModelChatMessage.User(prompt(prefix + suffix, prefix.length, language))], {
                justification: 'Provide native inline code completion', modelOptions: { temperature: 0, max_tokens: 512 },
            }, cts.token);
            let text = '';
            for await (const chunk of response.text) {
                if (cts.token.isCancellationRequested) return '';
                text += chunk;
                if (text.length > 2200) { cts.cancel(); return ''; }
            }
            const result = clean(text);
            output.info(`Native completion received: characters=${text.length}, accepted=${Boolean(result)}`);
            return token?.isCancellationRequested || cts.token.isCancellationRequested ? '' : result;
        } catch {
            if (cts.token.isCancellationRequested || token?.isCancellationRequested) output.info('Native completion cancelled; context changed or request timed out.');
            else output.warn('Native BYOK provider request failed; no Copilot fallback.');
            return '';
        } finally { clearTimeout(timer); cancellation?.dispose(); cts.dispose(); }
    }));
};
