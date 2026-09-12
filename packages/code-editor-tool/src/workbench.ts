import '@codingame/monaco-vscode-css-default-extension';
import '@codingame/monaco-vscode-html-default-extension';
import '@codingame/monaco-vscode-javascript-default-extension';
import '@codingame/monaco-vscode-json-default-extension';
import '@codingame/monaco-vscode-markdown-basics-default-extension';
import '@codingame/monaco-vscode-search-result-default-extension';
import '@codingame/monaco-vscode-theme-defaults-default-extension';
import '@codingame/monaco-vscode-theme-seti-default-extension';
import '@codingame/monaco-vscode-typescript-basics-default-extension';
import '@codingame/monaco-vscode-typescript-language-features-default-extension';
import 'vscode/localExtensionHost';

import { URI } from '@codingame/monaco-vscode-api/vscode/vs/base/common/uri';
import type { IStorageDatabase } from '@codingame/monaco-vscode-api/vscode/vs/base/parts/storage/common/storage';
import {
    initialize,
    LogLevel,
    type IEditorOverrideServices,
    type IWorkbenchConstructionOptions,
} from '@codingame/monaco-vscode-api';
import getAccessibilityServiceOverride from '@codingame/monaco-vscode-accessibility-service-override';
import getConfigurationServiceOverride, {
    initUserConfiguration,
} from '@codingame/monaco-vscode-configuration-service-override';
import getDialogsServiceOverride from '@codingame/monaco-vscode-dialogs-service-override';
import getEnvironmentServiceOverride from '@codingame/monaco-vscode-environment-service-override';
import getExplorerServiceOverride from '@codingame/monaco-vscode-explorer-service-override';
import {
    registerCustomProvider,
} from '@codingame/monaco-vscode-files-service-override';
import getKeybindingsServiceOverride, {
    initUserKeybindings,
} from '@codingame/monaco-vscode-keybindings-service-override';
import getLanguagesServiceOverride from '@codingame/monaco-vscode-languages-service-override';
import getLifecycleServiceOverride from '@codingame/monaco-vscode-lifecycle-service-override';
import getMarkersServiceOverride from '@codingame/monaco-vscode-markers-service-override';
import getModelServiceOverride from '@codingame/monaco-vscode-model-service-override';
import getNotificationsServiceOverride from '@codingame/monaco-vscode-notifications-service-override';
import getOutputServiceOverride from '@codingame/monaco-vscode-output-service-override';
import getPreferencesServiceOverride from '@codingame/monaco-vscode-preferences-service-override';
import getSearchServiceOverride from '@codingame/monaco-vscode-search-service-override';
import getSnippetsServiceOverride from '@codingame/monaco-vscode-snippets-service-override';
import getStorageServiceOverride, { StorageScope } from '@codingame/monaco-vscode-storage-service-override';
import getTextmateServiceOverride from '@codingame/monaco-vscode-textmate-service-override';
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override';
import getWorkbenchServiceOverride from '@codingame/monaco-vscode-workbench-service-override';
import getWorkingCopyServiceOverride from '@codingame/monaco-vscode-working-copy-service-override';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline';
import SearchWorker from '@codingame/monaco-vscode-search-service-override/worker?worker&inline';
import TextMateWorker from '@codingame/monaco-vscode-textmate-service-override/worker?worker&inline';
import OutputWorker from '@codingame/monaco-vscode-output-service-override/worker?worker&inline';
import * as vscode from 'vscode';

import { connectEditorEvents } from './editor-events';
import { MemoryStorageDatabase } from './memory-storage';
import { ToolApiClient } from './platform/client';
import { EventRecorder } from './platform/event-recorder';
import {
    LernumiFileSystemProvider,
    WORKSPACE_ROOT,
    WORKSPACE_SCHEME,
} from './platform/file-system';
import { ReplayController } from './replay/controller';
import { attachReplayController, registerReplayView } from './replay/view';

declare global {
    interface Window {
        MonacoEnvironment?: {
            getWorker(moduleId: string, label: string): Worker;
        };
    }
}

export async function startCodeEditor(
    container: HTMLElement,
    progress: (message: string) => void,
): Promise<void> {
    progress('Reading launch context…');
    const api = ToolApiClient.fromLaunchLocation();
    const context = await api.context();
    await api.startTokenRefresh();

    const canRecord = context.session.capabilities.includes('events:append');
    let syncStatus: vscode.StatusBarItem | null = null;
    const recorder = new EventRecorder(api, canRecord, (status, pending) => {
        if (!syncStatus) return;
        syncStatus.text = status === 'idle'
            ? '$(cloud) Saved to Lernumi'
            : status === 'syncing'
              ? `$(sync~spin) Recording ${pending}`
              : status === 'recording'
                ? `$(circle-filled) ${pending} pending`
                : `$(warning) ${status}`;
        syncStatus.tooltip = 'Code Editor event recording status';
        syncStatus.show();
    });
    await recorder.initialize(context);

    const provider = new LernumiFileSystemProvider(
        api,
        context.session.readOnly || !context.session.capabilities.includes('files:write'),
        (event) => recorder.add(event),
        Date.parse(context.workspace.createdAt),
    );
    registerCustomProvider(WORKSPACE_SCHEME, provider);

    if (context.session.capabilities.includes('replay:read')) registerReplayView();
    configureWorkers();

    progress('Preparing workspace…');
    await Promise.all([
        initUserConfiguration(JSON.stringify(defaultConfiguration(context.session.readOnly), null, 2)),
        initUserKeybindings('[]'),
    ]);

    const storageFactory = (): IStorageDatabase => new MemoryStorageDatabase();
    const services: IEditorOverrideServices = {
        ...getModelServiceOverride(),
        ...getNotificationsServiceOverride(),
        ...getDialogsServiceOverride(),
        ...getConfigurationServiceOverride(),
        ...getKeybindingsServiceOverride({ shouldUseGlobalKeybindings: () => true }),
        ...getTextmateServiceOverride(),
        ...getThemeServiceOverride(),
        ...getLanguagesServiceOverride(),
        ...getPreferencesServiceOverride(),
        ...getSnippetsServiceOverride(),
        ...getOutputServiceOverride(),
        ...getSearchServiceOverride(),
        ...getMarkersServiceOverride(),
        ...getAccessibilityServiceOverride(),
        ...getStorageServiceOverride({
            forcedValues: {
                'workbench.activity.showAccounts': false,
                'workbench.activityBar.location': 'default',
            },
            databaseFactories: {
                [StorageScope.APPLICATION]: storageFactory,
                [StorageScope.PROFILE]: storageFactory,
                [StorageScope.WORKSPACE]: storageFactory,
            },
        }),
        ...getLifecycleServiceOverride(),
        ...getEnvironmentServiceOverride(),
        ...getWorkingCopyServiceOverride({ storage: 'memory' }),
        ...getExplorerServiceOverride(),
        ...getWorkbenchServiceOverride(),
    };

    const options: IWorkbenchConstructionOptions = {
        workspaceProvider: {
            trusted: true,
            workspace: { folderUri: WORKSPACE_ROOT },
            async open() {
                return false;
            },
        },
        developmentOptions: { logLevel: LogLevel.Warning },
        configurationDefaults: defaultConfiguration(context.session.readOnly),
        productConfiguration: {
            nameShort: 'Lernumi Code',
            nameLong: 'Lernumi Code Editor',
        },
        windowIndicator: {
            label: `${context.offering.subject.code} · ${context.assessment.name}`,
            tooltip: `${context.workspace.name} · ${context.user.displayName}`,
            command: '',
        },
        defaultLayout: {
            force: true,
            views: [{ id: 'workbench.explorer.fileView' }],
        },
    };

    progress('Starting VS Code workbench…');
    await initialize(services, container, options, { userHome: URI.from({ scheme: 'tmp', path: '/' }) });

    syncStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    syncStatus.name = 'Lernumi recording';
    syncStatus.text = canRecord ? '$(cloud) Saved to Lernumi' : '$(lock) Read-only';
    syncStatus.show();

    const eventBridge = connectEditorEvents(provider, recorder);
    if (context.session.capabilities.includes('replay:read')) {
        attachReplayController(new ReplayController(api, recorder));
    }

    const output = vscode.window.createOutputChannel('Lernumi');
    output.appendLine(`Workspace: ${context.workspace.name}`);
    output.appendLine(`Assessment: ${context.offering.subject.code} · ${context.assessment.name}`);
    output.appendLine(`Role: ${context.role.roleName}`);
    output.appendLine(`Mode: ${context.session.mode}${context.session.readOnly ? ' (read-only)' : ''}`);

    window.addEventListener('lernumi:token-expired', () => {
        void vscode.window.showErrorMessage('Your Lernumi session expired. Reopen the tool from the assessment page.');
    });
    window.addEventListener('pagehide', () => {
        eventBridge.dispose();
        void recorder.flush();
    });
    document.title = `${context.offering.subject.code} · ${context.assessment.name} — Lernumi Code`;
}

function configureWorkers(): void {
    window.MonacoEnvironment = {
        getWorker(_moduleId, label) {
            if (label === 'TextMateWorker') return new TextMateWorker();
            if (label === 'OutputLinkDetectionWorker') return new OutputWorker();
            if (label === 'LocalFileSearchWorker') return new SearchWorker();
            return new EditorWorker();
        },
    };
}

function defaultConfiguration(readOnly: boolean): Record<string, unknown> {
    return {
        'workbench.startupEditor': 'none',
        'workbench.colorTheme': 'Default Dark Modern',
        'workbench.iconTheme': 'vs-seti',
        'workbench.activity.showAccounts': false,
        'workbench.layoutControl.enabled': false,
        'window.commandCenter': true,
        'window.menuBarVisibility': 'compact',
        'editor.fontFamily': "'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
        'editor.fontLigatures': true,
        'editor.minimap.enabled': true,
        'editor.formatOnPaste': false,
        'editor.formatOnSave': false,
        'files.autoSave': 'off',
        'files.enableTrash': false,
        'explorer.confirmDelete': true,
        'explorer.confirmDragAndDrop': true,
        'security.workspace.trust.enabled': false,
        'files.readonlyInclude': readOnly ? { '**': true } : {},
    };
}
