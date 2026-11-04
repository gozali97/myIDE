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
import { GOZAPP_DEBUG_PROMPT } from '../../common/gozappDebugPrompt.js';
import { BrowserViewCommandId } from '../../../../../platform/browserView/common/browserView.js';
import { validateGozappBrowserUrl } from '../../common/gozappBrowserUrl.js';
import { ChatConfiguration } from '../../common/constants.js';
import { AICustomizationManagementCommands, AICustomizationManagementSection } from '../../common/aiCustomizationWorkspaceService.js';
import { McpCommandIds } from '../../../../contrib/mcp/common/mcpCommandIds.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { consumeGozappProbe } from '../../common/gozappModelProbe.js';
import { ILanguageModelsService, ILanguageModelChatMetadata, ChatMessageRole, canHideModel } from '../../common/languageModels.js';
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
		@ILanguageModelsService private readonly languageModels: ILanguageModelsService,
		@ISecretStorageService private readonly secrets: ISecretStorageService,
		@ICommandService private readonly commands: ICommandService,
		@IConfigurationService private readonly configuration: IConfigurationService,
		@IFileService private readonly files: IFileService,
		@IUserDataProfileService private readonly profile: IUserDataProfileService,
		@IEditorService private readonly editors: IEditorService,
		@IDialogService private readonly dialogs: IDialogService,
	) { super(GozappSettingsEditor.ID, group, telemetry, theme, storage); }

	protected override createEditor(parent: HTMLElement): void {
		this.root = DOM.append(parent, DOM.$('.gozapp-settings'));
		const nav = DOM.append(this.root, DOM.$('nav'));
		nav.setAttribute('aria-label', 'Gozapp settings sections');
		DOM.append(nav, DOM.$('h2', undefined, 'Gozapp'));
		DOM.append(nav, DOM.$('p', undefined, 'Your editor. Your models.'));
		this.content = DOM.append(this.root, DOM.$('main'));
		this.button(nav, 'General & Layout', () => this.showGeneral(), this._store);
		this.button(nav, 'Models & API Keys', () => this.showModels(), this._store);
		this.button(nav, 'Agents & Chat', () => this.showAgents(), this._store);
		this.button(nav, 'Customize · Rules / Skills / MCP', () => this.showCustomize(), this._store);
		this.button(nav, 'Worktrees', () => this.showWorktrees(), this._store);
		this.button(nav, 'Debug Workflow', () => this.showDebug(), this._store);
		this.button(nav, 'Browser Testing', () => this.showBrowser(), this._store);
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

	private showWorktrees(): void {
		this.heading('Worktrees', 'Use a separate Git working directory for each independent task. Opening this page does not create branches, move changes or start agents.');
		DOM.append(this.content, DOM.$('p', undefined, 'Open a Git repository first. Create a worktree using the Git prompts, then open it in a new window and start a separate Agent session there. Review and merge each branch through your normal Git workflow.'));
		const status = DOM.append(this.content, DOM.$('p', { role: 'status' }));
		for (const [label, command] of [
			['Create Git worktree…', 'git.createWorktree'],
			['Open worktree in new window…', 'git.openWorktreeInNewWindow'],
		] as const) {
			const button = this.button(this.content, label, async () => {
				button.enabled = false;
				status.textContent = 'Follow the Git prompts to select the repository, branch and location. Cancelling leaves the operation unfinished.';
				try {
					await this.commands.executeCommand(command);
					status.textContent = 'Git workflow closed. Check Source Control for the resulting worktree; the operation may have been cancelled.';
				} catch {
					status.textContent = 'Unable to complete the Git worktree workflow. Ensure Git is installed, the built-in Git extension is enabled and a repository is open. Inspect Git Output for details.';
				} finally { button.enabled = true; }
			});
		}
		DOM.append(this.content, DOM.$('p', undefined, 'Worktrees isolate files and branches, not your operating system. Agents still share credentials, network access, ports and external services. Use separate test data/ports; never assume worktrees are security sandboxes.'));
		DOM.append(this.content, DOM.$('p', undefined, 'Uncommitted changes do not automatically move to a new worktree. Dependencies and local configuration may need setup. No automatic merge, deletion, cleanup or parallel-agent orchestration is implemented here.'));
	}

	private showGeneral(): void {
		this.heading('General & Layout', 'Personalize Gozapp. Changes apply immediately to your user settings; workspace or policy overrides may take precedence.');
		const status = DOM.append(this.content, DOM.$('p', { role: 'status' }));
		for (const setting of [
			{ key: 'workbench.activityBar.location', label: 'Navigation icons', options: [['top', 'Top of sidebar'], ['default', 'Side of sidebar'], ['bottom', 'Bottom of sidebar'], ['hidden', 'Hidden']] },
			{ key: 'workbench.statusBar.visible', label: 'Status bar', options: [['true', 'Visible'], ['false', 'Hidden']] },
			{ key: 'window.commandCenter', label: 'Command center in title bar', options: [['true', 'Visible'], ['false', 'Hidden']] },
		] as const) {
			const row = DOM.append(this.content, DOM.$('label.gozapp-field'));
			DOM.append(row, DOM.$('span', undefined, setting.label));
			const select = DOM.append(row, DOM.$<HTMLSelectElement>('select'));
			for (const [value, label] of setting.options) { DOM.append(select, DOM.$('option', { value }, label)); }
			const refresh = () => { select.value = String(this.configuration.getValue(setting.key)); };
			refresh();
			this.page.add(this.configuration.onDidChangeConfiguration(event => {
				if (event.affectsConfiguration(setting.key)) { refresh(); }
			}));
			this.page.add(DOM.addDisposableListener(select, 'change', async () => {
				const requested = select.value;
				const value = requested === 'true' ? true : requested === 'false' ? false : requested;
				select.disabled = true;
				try {
					await this.configuration.updateValue(setting.key, value, ConfigurationTarget.USER);
					refresh();
					status.textContent = select.value === requested ? 'Layout preference saved.' : 'User preference saved, but another scope or policy overrides it.';
				} catch { refresh(); status.textContent = 'Unable to save the layout preference.'; }
				finally { select.disabled = false; }
			}));
		}
		DOM.append(this.content, DOM.$('p', undefined, 'If navigation icons are hidden, return through the Gozapp Settings title-bar button or Command Palette to restore them.'));
	}

	private showDebug(): void {
		this.heading('Debug Workflow', 'Evidence-first debugging: reproduce, investigate, fix, and verify. This is a reusable prompt, not automatic runtime instrumentation.');
		DOM.append(this.content, DOM.$('p', undefined, 'Create the prompt below, then type /gozapp-debug in Chat and describe the bug. The selected model and normal tool permissions apply. Requests may use billed API tokens.'));
		const status = DOM.append(this.content, DOM.$('p', { role: 'status' }));
		this.button(this.content, 'Create / edit Debug prompt', async () => {
			try {
				const home = this.profile.currentProfile.promptsHome;
				const resource = URI.joinPath(home, 'gozapp-debug.prompt.md');
				if (!await this.files.exists(resource)) {
					await this.files.createFolder(home);
					await this.files.createFile(resource, VSBuffer.fromString(GOZAPP_DEBUG_PROMPT), { overwrite: false });
				}
				await this.editors.openEditor({ resource });
				status.textContent = 'Prompt ready. Existing customizations were preserved. Use /gozapp-debug in Chat; no request has been sent.';
			} catch { status.textContent = 'Unable to create/open the Debug prompt. Existing files were not overwritten.'; }
		});
		this.button(this.content, 'Open Chat', async () => {
			try { await this.commands.executeCommand('workbench.action.chat.open'); }
			catch { status.textContent = 'Unable to open Chat.'; }
		});
		DOM.append(this.content, DOM.$('p', undefined, 'Include expected behavior, actual behavior, reproduction steps and a sanitized error. Do not include credentials. Agent should explain any temporary logging and remove only instrumentation it introduced.'));
	}

	private showBrowser(): void {
		this.heading('Browser Testing', 'Open your running app in the integrated browser. This does not start a development server or automatically share the page with Agent.');
		const url = this.field(this.content, 'Application URL', 'http://localhost:3000');
		const status = DOM.append(this.content, DOM.$('p', { role: 'status' }));
		const browserToolsKey = 'workbench.browser.enableChatTools';
		const toolsRow = DOM.append(this.content, DOM.$('label.gozapp-field'));
		DOM.append(toolsRow, DOM.$('span', undefined, 'Agent browser testing tools'));
		const tools = DOM.append(toolsRow, DOM.$<HTMLSelectElement>('select'));
		DOM.append(tools, DOM.$('option', { value: 'false' }, 'Off — no built-in browser interaction'));
		DOM.append(tools, DOM.$('option', { value: 'true' }, 'On — allow browser tools with existing permissions'));
		const refreshTools = () => { tools.value = String(this.configuration.getValue<boolean>(browserToolsKey)); };
		refreshTools();
		this.page.add(this.configuration.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(browserToolsKey)) { refreshTools(); }
		}));
		this.page.add(DOM.addDisposableListener(tools, 'change', async () => {
			const requested = tools.value;
			tools.disabled = true;
			try {
				await this.configuration.updateValue(browserToolsKey, requested === 'true', ConfigurationTarget.USER);
				refreshTools();
				status.textContent = tools.value === requested
					? 'Browser tool preference saved. Start a new request to use the updated tool selection; this does not cancel a running tool.'
					: 'User preference saved, but a workspace setting or policy overrides it.';
			} catch { refreshTools(); status.textContent = 'Unable to save browser tool preference.'; }
			finally { tools.disabled = false; }
		}));
		DOM.append(this.content, DOM.$('p', undefined, 'Off disables built-in agent browser interaction, not manual browser tabs, terminal commands, or browser tools from MCP/extensions. Disable those separately in Customize → MCP / tool selection.'));
		this.button(this.content, 'Open application in Gozapp', async () => {
			let target: string;
			try { target = validateGozappBrowserUrl(url.value); }
			catch { status.textContent = 'Enter a full HTTP/HTTPS URL without embedded credentials, for example http://localhost:3000.'; return; }
			try {
				await this.commands.executeCommand(BrowserViewCommandId.Open, { url: target, openToSide: true });
				status.textContent = 'Browser opened. Check the page for connection errors; opening a tab does not prove the application loaded successfully.';
			} catch { status.textContent = 'Unable to open the integrated browser. This feature requires a supported desktop window.'; }
		});
		this.button(this.content, 'Configure Agent browser tools', async () => {
			try { await this.commands.executeCommand('workbench.action.openSettings', 'workbench.browser.enableChatTools'); }
			catch { status.textContent = 'Unable to open browser tool settings.'; }
		});
		DOM.append(this.content, DOM.$('p', undefined, 'Workflow: start your app, open its URL, enable browser tools if needed, then ask Agent to inspect or test it. Approve sharing only the intended tab. Screenshots need a vision-capable model. Availability also depends on workspace policy and the active agent.'));
		DOM.append(this.content, DOM.$('p', undefined, 'Browser tools can read page content and interact with signed-in services. Review clicks, submissions and scripts; use test accounts and avoid exposing secrets. Existing confirmation and network restrictions remain enabled.'));
	}

	private showCustomize(): void {
		this.heading('Customize', 'Manage the instructions and tools available to your agent. Opens the built-in manager for the selected category.');
		const feedback = DOM.append(this.content, DOM.$('p', { role: 'status' }));
		const run = async (command: string, ...args: unknown[]) => {
			try {
				feedback.textContent = 'Opening…';
				await this.commands.executeCommand(command, ...args);
				feedback.textContent = '';
			} catch {
				feedback.textContent = 'Unable to open this manager. Check that AI features are enabled and inspect Output for details.';
			}
		};
		for (const [label, section, description] of [
			['Rules / Instructions', AICustomizationManagementSection.Instructions, 'Project and personal coding guidelines. Check scope and whether instructions are enabled.'],
			['Skills', AICustomizationManagementSection.Skills, 'Reusable task instructions. Review their content before enabling third-party skills.'],
			['Custom Agents', AICustomizationManagementSection.Agents, 'Specialized agent roles and allowed tools.'],
			['Prompt Templates', AICustomizationManagementSection.Prompts, 'Reusable prompts for repeated workflows.'],
			['Hooks', AICustomizationManagementSection.Hooks, 'Automation may execute commands. Inspect scripts and permissions before enabling.'],
			['MCP Servers', AICustomizationManagementSection.McpServers, 'External tool integrations. Credentials, trust and server startup are managed separately.'],
		] as const) {
			const card = DOM.append(this.content, DOM.$('.gozapp-card'));
			this.button(card, label, () => run(AICustomizationManagementCommands.OpenEditor, section));
			DOM.append(card, DOM.$('p', undefined, description));
		}
		this.button(this.content, 'Add MCP server', () => run(McpCommandIds.AddConfiguration));
		this.button(this.content, 'MCP server status / start / stop', () => run(McpCommandIds.ListServer));
		DOM.append(this.content, DOM.$('p', undefined, 'No server is started and no permission is granted by opening this page. Available customizations depend on the active agent/session.'));
	}

	private showAgents(): void {
		this.heading('Agents & Chat', 'Use your configured model in Chat. Agent needs a model that supports tool calling.');
		DOM.append(this.content, DOM.$('p', undefined, 'Side Chat: type a question in the chat input, then select Ask in Side Chat from the input toolbar or Command Palette. It sends the draft to a separate conversation; the main request can continue. Provider support is required and API usage may be billed. If creation fails, the draft is restored when the input is still empty.'));
		const queueCard = DOM.append(this.content, DOM.$('.gozapp-card'));
		DOM.append(queueCard, DOM.$('h2', undefined, 'Messages while Agent is working'));
		const queueLabel = DOM.append(queueCard, DOM.$('label.gozapp-field'));
		DOM.append(queueLabel, DOM.$('span', undefined, 'Enter key behavior'));
		const queueMode = DOM.append(queueLabel, DOM.$<HTMLSelectElement>('select'));
		DOM.append(queueMode, DOM.$('option', { value: 'queue' }, 'Queue — wait until the current request finishes'));
		DOM.append(queueMode, DOM.$('option', { value: 'steer' }, 'Steer — send at the next opportunity'));
		const queueHelp = DOM.append(queueCard, DOM.$('p', { role: 'status' }));
		const refreshQueue = () => {
			queueMode.value = this.configuration.getValue<string>(ChatConfiguration.RequestQueueingDefaultAction) === 'queue' ? 'queue' : 'steer';
			queueHelp.textContent = queueMode.value === 'queue'
				? 'While working: Enter queues; Alt+Enter steers. When idle, input sends normally. Steering support depends on the active agent.'
				: 'While working: Enter steers; Alt+Enter queues. When idle, input sends normally. Steering support depends on the active agent.';
		};
		refreshQueue();
		this.page.add(this.configuration.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(ChatConfiguration.RequestQueueingDefaultAction)) { refreshQueue(); }
		}));
		this.page.add(DOM.addDisposableListener(queueMode, 'change', async () => {
			queueMode.disabled = true;
			try {
				await this.configuration.updateValue(ChatConfiguration.RequestQueueingDefaultAction, queueMode.value, ConfigurationTarget.USER);
				refreshQueue();
			} catch {
				refreshQueue();
				queueHelp.textContent = 'Unable to save message queue preference.';
			} finally { queueMode.disabled = false; }
		}));
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
		this.button(this.content, 'Review latest Senior instructions template', async () => {
			try {
				const editor = await this.editors.openEditor({ resource: undefined, contents: GOZAPP_DEVELOPER_INSTRUCTIONS, languageId: 'markdown', options: { pinned: true } });
				status.textContent = editor
					? 'Latest template opened as an unsaved document, not activated. Use Enable / edit Senior Full-stack instructions to open your profile file, compare and merge the rules you want, then save. Start a new chat and verify attached instructions.'
					: 'Unable to open the latest template. Existing profile instructions were not changed.';
			} catch { status.textContent = 'Unable to open the latest template. Existing profile instructions were not changed.'; }
		});
		DOM.append(this.content, DOM.$('h2', undefined, 'AI Autocomplete'));
		DOM.append(this.content, DOM.$('p', undefined, 'Optional inline suggestions using a registered provider/model. Off by default; sends bounded context from the active file and may incur API charges. Disable other AI completion providers to avoid duplicates.'));
		this.button(this.content, 'Select autocomplete provider / model', async () => {
			try { await this.commands.executeCommand('gozapp.autocomplete.selectModel'); }
			catch { status.textContent = 'Autocomplete extension is not available. Restart Gozapp and check extensions.'; }
		});
		this.button(this.content, 'Autocomplete On / Off and delay', () => this.commands.executeCommand('workbench.action.openSettings', 'gozapp.autocomplete'));
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
				const visibilityRow = DOM.append(row, DOM.$('label.gozapp-toggle'));
				const visible = DOM.append(visibilityRow, DOM.$<HTMLInputElement>('input', { type: 'checkbox', role: 'switch' }));
				DOM.append(visibilityRow, DOM.$('span', undefined, 'Show in chat model picker (applies immediately)'));
				const visibilityNote = DOM.append(row, DOM.$('p'));
				const identifier = () => selected && this.languageModels.getLanguageModelGroups(selected.vendor)
					.find(group => group.group?.name === selected.name)?.modelIdentifiers
					.find(identifier => this.languageModels.lookupLanguageModel(identifier)?.id === id);
				const refreshVisibility = () => {
					const registered = identifier();
					visible.disabled = !registered || !canHideModel(registered, this.languageModels.lookupLanguageModel(registered));
					visible.checked = !!registered && !this.languageModels.isModelHidden(registered);
					visibilityNote.textContent = !registered ? 'Save/register this model first to change visibility.'
						: visible.disabled ? 'This model cannot be hidden.' : 'Agent still requires tool calling. Visibility does not change model capabilities.';
				};
				modelRows.add(DOM.addDisposableListener(visible, 'change', () => {
					const registered = identifier();
					if (registered) { this.languageModels.setModelHidden(registered, !visible.checked); }
					refreshVisibility();
				}));
				modelRows.add(this.languageModels.onDidChangeModelVisibility(refreshVisibility));
				modelRows.add(this.languageModels.onDidChangeLanguageModels(refreshVisibility));
				refreshVisibility();
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
		this.button(this.content, 'Check saved model registration (no API request)', () => {
			DOM.clearNode(diagnostics);
			if (!selected) {
				status.textContent = 'Save the provider first. This check uses saved settings, not unsaved edits.';
				return;
			}
			const group = this.languageModels.getLanguageModelGroups(selected.vendor).find(group => group.group?.name === selected.name);
			status.textContent = 'Local registration only: this does not verify credentials, connectivity, streaming or actual tool support.';
			for (const configured of existingModels) {
				const model = group?.modelIdentifiers.map(id => this.languageModels.lookupLanguageModel(id)).find(model => model?.id === configured.id);
				const detail = model
					? `Registered · ${ILanguageModelChatMetadata.suitableForAgentMode(model) ? 'Agent capable (declared)' : 'Ask only'} · input ${model.maxInputTokens} · output ${model.maxOutputTokens} · ${model.isUserSelectable === false ? 'not selectable' : 'selectable'}${this.languageModels.isGroupHidden(selected.vendor, selected.name) ? ' · provider hidden in picker' : ''}`
					: 'Not registered yet. Check AI extension activation and provider errors in Output; save/reload if configuration was just changed.';
				DOM.append(diagnostics, DOM.$('p', undefined, `${String(configured.id)}: ${detail}`));
			}
		});
		const diagnostics = DOM.append(this.content, DOM.$('div', { role: 'status', 'aria-live': 'polite' }));
		if (selected) {
			const probeControls = DOM.append(this.content, DOM.$('.gozapp-card'));
			DOM.append(probeControls, DOM.$('h3', undefined, 'Test saved model connection'));
			const picker = DOM.append(probeControls, DOM.$<HTMLSelectElement>('select', { 'aria-label': 'Model to test' }));
			for (const model of existingModels) {
				DOM.append(picker, DOM.$('option', { value: String(model.id) }, String(model.id)));
			}
			let cancelProbe: (() => void) | undefined;
			let disposed = false;
			this.page.add(toDisposable(() => { disposed = true; cancelProbe?.(); }));
			const probeStatus = DOM.append(probeControls, DOM.$('p', { role: 'status', 'aria-live': 'polite' }));
			const test = this.button(probeControls, 'Test connection (uses API tokens)', async () => {
				test.enabled = false;
				try {
					const modelId = picker.value;
					const group = this.languageModels.getLanguageModelGroups(selected.vendor).find(group => group.group?.name === selected.name);
					const identifier = group?.modelIdentifiers.find(id => this.languageModels.lookupLanguageModel(id)?.id === modelId);
					if (!identifier) { probeStatus.textContent = 'Model not registered. Run the local registration check first.'; return; }
					const consent = await this.dialogs.confirm({ message: `Test ${modelId}?`, detail: 'Sends only “Reply with OK.” using the saved provider and API key. No project content or tools are sent. Provider token charges may apply; configured output limits still apply.', primaryButton: 'Send test request' });
					if (!consent.confirmed || disposed) { return; }
					const token = new CancellationTokenSource();
					let cancelled = false;
					let timedOut = false;
					let rejectWait!: (error: Error) => void;
					const interrupted = new Promise<never>((_, reject) => { rejectWait = reject; });
					cancelProbe = () => { cancelled = true; token.cancel(); rejectWait(new Error('CANCELLED')); };
					cancel.enabled = true;
					probeStatus.textContent = 'Connecting — waiting for first text response…';
					const timer = setTimeout(() => { timedOut = true; token.cancel(); rejectWait(new Error('TIMEOUT')); }, 30000);
					const start = Date.now();
					try {
						const run = async () => {
							const response = await this.languageModels.sendChatRequest(identifier, undefined,
								[{ role: ChatMessageRole.User, content: [{ type: 'text', value: 'Reply with OK.' }] }], {}, token.token);
							return consumeGozappProbe(response, () => {
								if (!disposed && !token.token.isCancellationRequested) { probeStatus.textContent = 'Text received — waiting for completion…'; }
							});
						};
						const chunks = await Promise.race([run(), interrupted]);
						if (!disposed) { probeStatus.textContent = `Completed in ${((Date.now() - start) / 1000).toFixed(1)}s (${chunks} text chunks). Credentials and text response worked. Tool calling and true incremental server streaming are not verified.`; }
					} catch {
						if (!disposed) { probeStatus.textContent = timedOut ? 'Timed out after 30s; cancellation requested. Provider may still bill in-flight work.' : cancelled ? 'Cancelled; provider may still bill in-flight work.' : 'Request failed or returned no text. Check provider credentials, endpoint, model ID and TLS in Output. No response or raw error is displayed here to avoid exposing secrets.'; }
					} finally {
						clearTimeout(timer); token.dispose(true); cancelProbe = undefined;
						if (!disposed) { cancel.enabled = false; }
					}
				} catch {
					if (!disposed) { probeStatus.textContent = 'Unable to start the connection test.'; }
				} finally { if (!disposed) { test.enabled = true; } }
			});
			const cancel = this.button(probeControls, 'Cancel test', () => cancelProbe?.());
			cancel.enabled = false;
		}
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
