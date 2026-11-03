/* Licensed under the MIT License. */
import './media/gozappSettings.css';
import * as DOM from '../../../../../base/browser/dom.js';
import { InputBox } from '../../../../../base/browser/ui/inputbox/inputBox.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { URI } from '../../../../../base/common/uri.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IConfigurationService, ConfigurationTarget } from '../../../../../platform/configuration/common/configuration.js';
import { IUserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfile.js';
import { GOZAPP_PONYTAIL_INSTRUCTIONS } from '../../common/gozappPonytailInstructions.js';
import { GOZAPP_DEVELOPER_INSTRUCTIONS } from '../../common/gozappDeveloperInstructions.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IInstantiationService, ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ISecretStorageService } from '../../../../../platform/secrets/common/secrets.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { defaultButtonStyles, defaultInputBoxStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { EditorPane } from '../../../../browser/parts/editor/editorPane.js';
import { TitleBarLeadingActionsGroup } from '../../../../browser/parts/titlebar/titlebarActions.js';
import { IEditorPaneRegistry, EditorPaneDescriptor } from '../../../../browser/editor.js';
import { EditorExtensions, EditorInputCapabilities, IUntypedEditorInput, IEditorFactoryRegistry, IEditorSerializer } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { ILanguageModelsConfigurationService, ILanguageModelsProviderGroup } from '../../common/languageModelsConfiguration.js';
import { buildGozappModelGroup, isValidGozappModelId } from '../../common/gozappModelConfig.js';

class GozappSettingsInput extends EditorInput {
	static readonly ID = 'workbench.input.gozappSettings';
	readonly resource = undefined;
	override get typeId() { return GozappSettingsInput.ID; }
	override get capabilities() { return super.capabilities | EditorInputCapabilities.Singleton; }
	override getName() { return 'Gozapp Settings'; }
	override getIcon() { return Codicon.settingsGear; }
	override matches(other: EditorInput | IUntypedEditorInput) { return other instanceof GozappSettingsInput; }
}

class GozappSettingsEditor extends EditorPane {
	static readonly ID = 'workbench.editor.gozappSettings';
	private root!: HTMLElement;
	private content!: HTMLElement;
	private readonly page = this._register(new DisposableStore());
	constructor(group: IEditorGroup,
		@ITelemetryService telemetry: ITelemetryService,
		@IThemeService theme: IThemeService,
		@IStorageService storage: IStorageService,
		@ILanguageModelsConfigurationService private readonly models: ILanguageModelsConfigurationService,
		@ISecretStorageService private readonly secrets: ISecretStorageService,
		@ICommandService private readonly commands: ICommandService,
		@IConfigurationService private readonly configuration: IConfigurationService,
		@IFileService private readonly files: IFileService,
		@IUserDataProfileService private readonly profile: IUserDataProfileService,
		@IEditorService private readonly editors: IEditorService,
	) { super(GozappSettingsEditor.ID, group, telemetry, theme, storage); }

	protected override createEditor(parent: HTMLElement): void {
		this.root = DOM.append(parent, DOM.$('.gozapp-settings'));
		const nav = DOM.append(this.root, DOM.$('nav'));
		nav.setAttribute('aria-label', 'Gozapp settings sections');
		DOM.append(nav, DOM.$('h2', undefined, 'Gozapp'));
		DOM.append(nav, DOM.$('p', undefined, 'Your editor. Your models.'));
		this.content = DOM.append(this.root, DOM.$('main'));
		this.button(nav, 'Models & API Keys', () => this.showModels(), this._store);
		this.button(nav, 'Agents & Chat', () => this.showAgents(), this._store);
		this.button(nav, 'Editor Settings ↗', () => this.commands.executeCommand('workbench.action.openSettings'), this._store);
		void this.models.whenReady.then(() => { if (!this._store.isDisposed) { this.showModels(); } });
	}

	private button(parent: HTMLElement, label: string, action: () => unknown, store = this.page): Button {
		const button = store.add(new Button(parent, { ...defaultButtonStyles, secondary: true }));
		button.label = label;
		store.add(button.onDidClick(() => { action(); }));
		return button;
	}

	private field(parent: HTMLElement, label: string, value = '', type = 'text', store = this.page): InputBox {
		const row = DOM.append(parent, DOM.$('.gozapp-field'));
		DOM.append(row, DOM.$('span', undefined, label));
		const input = store.add(new InputBox(row, undefined, { ariaLabel: label, type, inputBoxStyles: defaultInputBoxStyles }));
		input.value = value;
		return input;
	}

	private heading(title: string, description: string): void {
		this.page.clear();
		DOM.clearNode(this.content);
		DOM.append(this.content, DOM.$('h1', undefined, title));
		DOM.append(this.content, DOM.$('p', undefined, description));
	}

	private showAgents(): void {
		this.heading('Agents & Chat', 'Use your configured model in Chat. Agent needs a model that supports tool calling.');
		this.button(this.content, 'Open Chat / Agent', () => this.commands.executeCommand('workbench.action.chat.open'));
		DOM.append(this.content, DOM.$('p', undefined, 'Progress: “Finished with steps” completes a section, not necessarily the task. “Subagent running” means delegated work is pending: expand its step to inspect it. MCP “Start it now?” requires your permission. Use Stop to cancel; inspect pending file changes before retrying.'));
		const status = DOM.append(this.content, DOM.$('p', { role: 'status' }));
		DOM.append(this.content, DOM.$('p', undefined, 'Edit review and terminal permissions are separate. Auto-accepting file edits does not approve shell commands. Python scripts and shell heredocs may still require confirmation. Configure narrow terminal rules rather than allowing every command.'));
		this.button(this.content, 'Terminal approval rules', () => this.commands.executeCommand('workbench.action.openSettings', 'chat.tools.terminal.autoApprove'));
		this.button(this.content, 'File edit review settings', () => this.commands.executeCommand('workbench.action.openSettings', 'chat.editing.autoAcceptDelay'));
		this.button(this.content, 'Enable automatic context compaction', async () => {
			try {
				await this.configuration.updateValue('github.copilot.chat.summarizeAgentConversationHistory.enabled', true, ConfigurationTarget.USER);
				status.textContent = 'Auto-compaction enabled. Agent budgets follow the selected model input limit, with tool overhead and a safety margin. Use /compact to compact manually. Oversized individual inputs may still exceed the limit.';
			} catch { status.textContent = 'Unable to enable automatic compaction.'; }
		});
		this.button(this.content, 'Require manual review of agent edits', async () => {
			try {
				await this.configuration.updateValue('chat.editing.autoAcceptDelay', 0, ConfigurationTarget.USER);
				status.textContent = 'Automatic acceptance disabled. Open changed files from chat to review red/green diffs. Keep approves an edit; Undo rejects it. Edits may already be saved on disk before review.';
			} catch { status.textContent = 'Unable to update review settings.'; }
		});
		DOM.append(this.content, DOM.$('h2', undefined, 'Ponytail — efficient coding'));
		DOM.append(this.content, DOM.$('p', undefined, 'Compact MIT-licensed adaptation of DietrichGebert/ponytail. Uses targeted reads and minimal edits; token savings depend on the model and task. No plugin hooks or automatic updates.'));
		this.button(this.content, 'Enable / edit Ponytail instructions', async () => {
			try {
				const home = this.profile.currentProfile.promptsHome;
				const resource = URI.joinPath(home, 'gozapp-ponytail.instructions.md');
				if (!await this.files.exists(resource)) {
					await this.files.createFolder(home);
					await this.files.createFile(resource, VSBuffer.fromString(GOZAPP_PONYTAIL_INSTRUCTIONS), { overwrite: false });
				}
				await this.editors.openEditor({ resource });
				status.textContent = 'Ponytail instructions created/opened without replacing existing edits. Start a new chat and verify attached instructions. To disable, remove this instruction file.';
			} catch { status.textContent = 'Unable to open Ponytail instructions. Existing files were not overwritten.'; }
		});
		this.button(this.content, 'Enable / edit Senior Full-stack instructions', async () => {
			try {
				const home = this.profile.currentProfile.promptsHome;
				const resource = URI.joinPath(home, 'gozapp-senior.instructions.md');
				if (!await this.files.exists(resource)) {
					await this.files.createFolder(home);
					await this.files.createFile(resource, VSBuffer.fromString(GOZAPP_DEVELOPER_INSTRUCTIONS), { overwrite: false });
				}
				await this.editors.openEditor({ resource });
				status.textContent = 'Profile instructions created/opened. Existing customizations are preserved. Start a new chat and check attached instructions.';
			} catch { status.textContent = 'Unable to open developer instructions. Existing instructions were not overwritten.'; }
		});
		this.button(this.content, 'Agent Settings', () => this.commands.executeCommand('workbench.action.openSettings', '@tag:chatAgent'));
		DOM.append(this.content, DOM.$('p', undefined, 'Review file changes and terminal commands before approval. Cloud agents, Cursor Tab and Cursor indexing are not implemented in Gozapp.'));
	}

	private showModels(selected?: ILanguageModelsProviderGroup): void {
		this.heading('Models', 'Connect your own API endpoint. No JSON editing. API usage may be billed by your provider.');
		const groups = this.models.getLanguageModelsProviderGroups().filter(g => g.vendor === 'customendpoint');
		const list = DOM.append(this.content, DOM.$('.gozapp-providers'));
		for (const group of groups) {
			this.button(list, group.name, () => this.showModels(group));
		}
		this.button(list, '+ Add provider', () => this.showModels());
		DOM.append(this.content, DOM.$('h2', undefined, selected ? `API Keys — ${selected.name}` : 'API Keys — New provider'));
		const card = DOM.append(this.content, DOM.$('.gozapp-card'));
		const existingModels = Array.isArray(selected?.models) ? selected.models as Record<string, unknown>[] : [];
		const first = existingModels[0];
		const name = this.field(card, 'Provider name', selected?.name ?? 'My API');
		const base = this.field(card, 'Base URL / endpoint', typeof first?.url === 'string' ? first.url : 'https://api.openai.com/v1');
		const key = this.field(card, selected?.apiKey ? 'API key (saved securely; leave blank to keep)' : 'API key (optional for local models)', '', 'password');
		key.inputElement.autocomplete = 'new-password';
		const row = DOM.append(card, DOM.$('label.gozapp-field'));
		DOM.append(row, DOM.$('span', undefined, 'API format'));
		const api = DOM.append(row, DOM.$<HTMLSelectElement>('select'));
		for (const [value, text] of [['chat-completions', 'OpenAI Chat Completions'], ['responses', 'OpenAI Responses'], ['messages', 'Anthropic Messages']]) {
			const option = DOM.append(api, DOM.$<HTMLOptionElement>('option', { value }, text));
			option.selected = value === (selected?.apiType ?? 'chat-completions');
		}
		const modelSection = DOM.append(card, DOM.$('.gozapp-models'));
		DOM.append(modelSection, DOM.$('h2', undefined, 'Models'));
		DOM.append(modelSection, DOM.$('p', undefined, 'Add exact model IDs from your provider. Tool calling is required for models to appear in Agent mode.'));
		const modelList = DOM.append(modelSection, DOM.$('.gozapp-model-list'));
		const modelIds = existingModels.map(m => String(m.id));
		const limits = new Map(existingModels.map(m => [String(m.id), {
			input: String(m.maxInputTokens ?? 32000), output: String(m.maxOutputTokens ?? 4096),
			toolCalling: m.toolCalling === true, vision: m.vision === true,
		}]));
		DOM.append(modelSection, DOM.$('p', undefined, 'Token limits are per model. Input is the prompt budget for instructions, history, files and tools; reserve output space within the provider context window. Defaults for new models (32,000 input / 4,096 output) are placeholders, not verified provider limits.'));
		const modelRows = this.page.add(new DisposableStore());
		const renderModels = () => {
			modelRows.clear();
			DOM.clearNode(modelList);
			for (const id of modelIds) {
				const row = DOM.append(modelList, DOM.$('.gozapp-model-row'));
				DOM.append(row, DOM.$('h3', undefined, id));
				const limit = limits.get(id)!;
				const input = this.field(row, `${id} — Max input tokens`, limit.input, 'number', modelRows);
				const output = this.field(row, `${id} — Max output tokens`, limit.output, 'number', modelRows);
				modelRows.add(input.onDidChange(value => { limit.input = value; }));
				modelRows.add(output.onDidChange(value => { limit.output = value; }));
				for (const [property, label] of [['toolCalling', 'Tool calling (required for Agent)'], ['vision', 'Image input']] as const) {
					const toggle = DOM.append(row, DOM.$('label.gozapp-toggle'));
					const box = DOM.append(toggle, DOM.$<HTMLInputElement>('input', { type: 'checkbox', role: 'switch' }));
					box.checked = limit[property];
					DOM.append(toggle, DOM.$('span', undefined, label));
					modelRows.add(DOM.addDisposableListener(box, 'change', () => { limit[property] = box.checked; }));
				}
				this.button(row, 'Remove', () => { modelIds.splice(modelIds.indexOf(id), 1); renderModels(); }, modelRows);
			}
		};
		renderModels();
		const newModel = this.field(modelSection, 'New model ID');
		const modelStatus = DOM.append(modelSection, DOM.$('p', { role: 'status' }));
		this.button(modelSection, '+ Add model', () => {
			const id = newModel.value.trim();
			if (!isValidGozappModelId(id) || modelIds.includes(id) || modelIds.length >= 100) {
				modelStatus.textContent = 'Enter a unique model ID without spaces or commas (maximum 100 models).';
				return;
			}
			modelIds.push(id);
			limits.set(id, { input: '32000', output: '4096', toolCalling: false, vision: false });
			newModel.value = '';
			modelStatus.textContent = 'Model added to draft. Save provider to apply.';
			renderModels();
		});
		const status = DOM.append(this.content, DOM.$('p', { role: 'status', 'aria-live': 'polite' }));
		const save = this.button(this.content, 'Save provider', async () => {
			save.enabled = false;
			let secretId: string | undefined;
			let committed = false;
			try {
				if (newModel.value.trim()) { throw new Error('Click Add model before saving, or clear the new model field.'); }
				if (!modelIds.length) { throw new Error('Add at least one model before saving.'); }
				const groups = modelIds.map(id => {
					const limit = limits.get(id)!;
					try {
						return buildGozappModelGroup({ name: name.value, baseUrl: base.value, modelIds: id, apiType: api.value,
							inputTokens: Number(limit.input), outputTokens: Number(limit.output), toolCalling: limit.toolCalling, vision: limit.vision });
					} catch (error) { throw new Error(`${id}: ${error instanceof Error ? error.message : 'Invalid model configuration'}`); }
				});
				const group = { ...groups[0], models: groups.flatMap(group => group.models) };
				const latest = this.models.getLanguageModelsProviderGroups();
				if (latest.some(g => g.vendor === group.vendor && g.name === group.name && g.name !== selected?.name)) {
					throw new Error('A provider with that name already exists. Select it above to edit.');
				}
				const current = selected && latest.find(g => g.vendor === selected.vendor && g.name === selected.name);
				if (selected && (!current || JSON.stringify(current) !== JSON.stringify(selected))) {
					throw new Error('Configuration changed elsewhere. Reopen Gozapp Settings before saving.');
				}
				if (selected?.apiKey && !key.value.trim() && existingModels.some(model =>
					typeof model.url === 'string' && new URL(model.url).origin !== new URL(group.models[0].url).origin)) {
					throw new Error('Endpoint host changed. Re-enter the API key to confirm sending it to the new provider.');
				}
				let apiKey = selected?.apiKey;
				if (key.value.trim()) {
					secretId = `chat.lm.secret.gozapp.${generateUuid()}`;
					await this.secrets.set(secretId, key.value.trim());
					apiKey = '${input:' + secretId + '}';
				}
				const updated = { ...selected, ...group, apiKey };
				const saved = current
					? await this.models.updateLanguageModelsProviderGroup(current, updated)
					: await this.models.addLanguageModelsProviderGroup(updated);
				committed = true;
				if (secretId && typeof selected?.apiKey === 'string' && selected.apiKey.startsWith('${input:chat.lm.secret.gozapp.')) {
					await this.secrets.delete(selected.apiKey.slice(8, -1));
				}
				this.showModels(saved);
				DOM.append(this.content, DOM.$('p', { role: 'status' }, group.models.some(model => model.toolCalling) ? 'Saved. Only models with tool calling enabled appear in Agent mode; other models are available in Ask. Connection has not been tested.' : 'Saved for Ask mode. These models will not appear in Agent mode because tool calling is disabled. Switch chat to Ask, or enable tool calling if your provider supports it. Connection has not been tested.'));
			} catch (error) {
				if (secretId && !committed) { await this.secrets.delete(secretId); }
				status.textContent = error instanceof Error ? error.message : 'Unable to save provider.';
			} finally { save.enabled = true; }
		});
		this.button(this.content, 'Open Chat / Agent', () => this.commands.executeCommand('workbench.action.chat.open'));
	}

	override layout(dimension: DOM.Dimension): void {
		if (this.root) { this.root.style.height = `${dimension.height}px`; }
	}
	override focus(): void { super.focus(); this.content?.querySelector('input')?.focus(); }
}

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(GozappSettingsEditor, GozappSettingsEditor.ID, 'Gozapp Settings'),
	[new SyncDescriptor(GozappSettingsInput)],
);
class GozappSettingsSerializer implements IEditorSerializer {
	canSerialize(): boolean { return true; }
	serialize(): string { return ''; }
	deserialize(instantiationService: IInstantiationService): EditorInput {
		return instantiationService.createInstance(GozappSettingsInput);
	}
}
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(GozappSettingsInput.ID, GozappSettingsSerializer);

registerAction2(class extends Action2 {
	constructor() {
		super({ id: 'workbench.action.gozappSettings', title: { value: 'Gozapp Settings', original: 'Gozapp Settings' }, f1: true, icon: Codicon.settingsGear,
			menu: [{ id: MenuId.GlobalActivity, group: '1_settings', order: 0 },
				{ id: MenuId.MenubarPreferencesMenu, group: '1_settings', order: 0 },
				{ id: MenuId.TitleBar, group: TitleBarLeadingActionsGroup, order: 0 }] });
	}
	run(accessor: ServicesAccessor) {
		return accessor.get(IEditorService).openEditor(accessor.get(IInstantiationService).createInstance(GozappSettingsInput), { pinned: true });
	}
});
