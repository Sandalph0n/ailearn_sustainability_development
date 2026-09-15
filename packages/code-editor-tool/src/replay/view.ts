import type { IDisposable } from 'monaco-editor';
import { StandaloneServices } from '@codingame/monaco-vscode-api';
import { URI } from '@codingame/monaco-vscode-api/vscode/vs/base/common/uri';
import { ILanguageService } from '@codingame/monaco-vscode-api/vscode/vs/editor/common/languages/language.service';
import { getIconClasses } from '@codingame/monaco-vscode-api/vscode/vs/editor/common/services/getIconClasses';
import { IModelService } from '@codingame/monaco-vscode-api/vscode/vs/editor/common/services/model.service';
import { FileKind } from '@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files';
import {
    registerCustomView,
    viewContainerRegistry,
    ViewContainerLocation,
} from '@codingame/monaco-vscode-workbench-service-override';
import { IViewsService } from '@codingame/monaco-vscode-api/vscode/vs/workbench/services/views/common/viewsService.service';
import * as vscode from 'vscode';

import type { ReplayController, ReplayFrame } from './controller';
import { HISTORY_SCHEME, HistoryFileSystemProvider, historyUri } from './history-file-system';
import { historyChildren } from './history-tree';
import { ReplayTransport } from './transport';
import dashboardCss from './webview/dashboard.css?raw';
import dashboardScript from './webview/dashboard.js?raw';
import replayCss from './webview/replay.css?raw';
import replayScript from './webview/replay.js?raw';

let controller: ReplayController | null = null;
let renderNavigation: (() => void) | null = null;
let renderHistory: (() => void) | null = null;
let replayTransport: ReplayTransport | null = null;
let historyPlayheadThrottle: ReturnType<typeof setTimeout> | null = null;
const expandedHistoryFolders = new Set<string>();
const REPLAY_PANEL_VIEW_ID = 'lernumi.logInspector.replayControls';

/**
 * Activity Bar container matching MQ Smart Learning: the sidebar is navigation only. The actual
 * Dashboard and Replay player open as full editor tabs where their tables and timeline have room.
 */
export function registerReplayView(options: { openByDefault: boolean }): void {
    registerCustomView({
        id: 'lernumi.logInspector',
        name: 'Log Inspector',
        order: 20,
        default: options.openByDefault,
        location: ViewContainerLocation.Sidebar,
        icon: new URL('../assets/replay.svg', import.meta.url).toString(),
        actions: [{
            id: 'lernumi.logInspector.refresh',
            title: 'Refresh activity log',
            tooltip: 'Refresh activity log',
            icon: 'refresh',
            async run() { await controller?.refresh(); },
        }],
        renderBody(container): IDisposable {
            container.classList.add('lernumi-inspector-nav');
            const render = () => renderNav(container);
            renderNavigation = render;
            render();
            return {
                dispose() {
                    if (renderNavigation === render) renderNavigation = null;
                },
            };
        },
    });

    const viewContainer = viewContainerRegistry.get('lernumi.logInspector');
    if (!viewContainer) throw new Error('Log Inspector view container was not registered');
    registerCustomView({
        id: 'lernumi.logInspector.history',
        name: 'History Explorer',
        order: 2,
        location: ViewContainerLocation.Sidebar,
        viewContainer,
        actions: [{
            id: 'lernumi.logInspector.history.collapseAll',
            title: 'Collapse folders in history',
            tooltip: 'Collapse folders in history',
            icon: 'collapseAll',
            async run() {
                expandedHistoryFolders.clear();
                renderHistory?.();
            },
        }],
        renderBody(container): IDisposable {
            container.classList.add('lernumi-history-explorer', 'show-file-icons', 'file-icon-themable-tree');
            const render = () => renderHistoryTree(container);
            renderHistory = render;
            render();
            return {
                dispose() {
                    if (renderHistory === render) renderHistory = null;
                },
            };
        },
    });

    registerCustomView({
        id: REPLAY_PANEL_VIEW_ID,
        name: 'Replay',
        order: 10,
        location: ViewContainerLocation.Panel,
        canMoveView: true,
        canToggleVisibility: true,
        renderBody(container): IDisposable {
            container.classList.add('lernumi-replay-transport-host');
            const transport = new ReplayTransport(container, {
                revealEditor() {
                    if (controller) ReplayPanel.show(controller);
                },
                showFrame(frame) {
                    ReplayPanel.showFrame(frame);
                },
            });
            replayTransport = transport;
            if (controller) transport.connect(controller);
            return {
                dispose() {
                    transport.dispose();
                    if (replayTransport === transport) replayTransport = null;
                },
            };
        },
    });
}

export function attachReplayController(value: ReplayController): void {
    controller = value;
    vscode.workspace.registerFileSystemProvider(
        HISTORY_SCHEME,
        new HistoryFileSystemProvider(value),
        { isCaseSensitive: true, isReadonly: true },
    );
    value.onDidChange(() => {
        renderNavigation?.();
        renderHistory?.();
        replayTransport?.syncFromModel();
    });
    value.onDidChangePlayhead(() => {
        if (historyPlayheadThrottle) return;
        historyPlayheadThrottle = setTimeout(() => {
            historyPlayheadThrottle = null;
            renderHistory?.();
        }, 250);
        replayTransport?.syncPlayhead();
    });
    replayTransport?.connect(value);
    renderNavigation?.();
    renderHistory?.();
    void value.refresh();
}

function renderNav(container: HTMLElement): void {
    container.replaceChildren();
    const state = controller?.snapshot();
    const rows = document.createElement('div');
    rows.className = 'inspector-nav-rows';
    rows.append(
        navigationRow('graph', 'Dashboard', 'Chain, sessions, flags', () => {
            if (!controller) return;
            DashboardPanel.show(controller);
            void controller.refresh();
        }),
        navigationRow('play-circle', 'Replay', 'Watch the code being written', () => {
            if (!controller) return;
            void openReplay(controller);
            void controller.refresh();
        }, !state || state.sessions.length === 0),
    );
    container.append(rows);

    const status = document.createElement('div');
    status.className = 'inspector-nav-status';
    if (!state || state.loading) status.textContent = 'Loading activity log…';
    else if (state.message) status.textContent = state.message;
    else if (state.sessions.length > 0) {
        const count = controller?.history().total ?? 0;
        status.textContent = `${count} activity ${count === 1 ? 'event' : 'events'} in ${state.scope === 'all' ? 'all sessions' : 'selected session'}`;
    }
    else status.textContent = 'No recorded session';
    container.append(status);
}

function navigationRow(
    icon: string,
    label: string,
    description: string,
    run: () => void,
    disabled = false,
): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inspector-nav-row';
    button.disabled = disabled;
    const iconElement = document.createElement('span');
    iconElement.className = `inspector-nav-icon codicon codicon-${icon}`;
    const copy = document.createElement('span');
    copy.className = 'inspector-nav-copy';
    const title = document.createElement('span');
    title.className = 'inspector-nav-title';
    title.textContent = label;
    const detail = document.createElement('span');
    detail.className = 'inspector-nav-description';
    detail.textContent = description;
    copy.append(title, detail);
    button.append(iconElement, copy);
    button.addEventListener('click', run);
    return button;
}

function renderHistoryTree(container: HTMLElement): void {
    container.replaceChildren();
    const model = controller;
    if (!model) {
        container.append(historyMessage('Loading history…'));
        return;
    }

    const state = model.snapshot();
    if (state.loading && state.events.length === 0) {
        container.append(historyMessage('Loading history…'));
        return;
    }
    if (state.message) {
        container.append(historyMessage(state.message, 'warning'));
        return;
    }

    const history = model.history();
    const rootEntries = historyChildren(history.workspace);
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    meta.textContent = history.total === 0
        ? (rootEntries.length > 0 ? 'Initial workspace' : 'No recorded activity')
        : history.position === 0
          ? `0/${history.total} · initial workspace`
          : `${history.position}/${history.total} · ${new Date(history.at).toLocaleTimeString()}`;
    container.append(meta);

    if (!history.sessionId || rootEntries.length === 0) {
        container.append(historyMessage(
            history.total === 0
                ? 'No files were recorded in this session.'
                : 'No files at this point. Move the replay playhead forward.',
        ));
        return;
    }

    const tree = document.createElement('div');
    tree.className = 'history-tree';
    tree.setAttribute('role', 'tree');
    appendHistoryLevel(tree, history, '/', 0);
    tree.addEventListener('keydown', navigateHistoryTree);
    container.append(tree);
}

function appendHistoryLevel(
    tree: HTMLElement,
    history: ReturnType<ReplayController['history']>,
    parentPath: string,
    depth: number,
): void {
    for (const entry of historyChildren(history.workspace, parentPath)) {
        const isFolder = entry.kind === 'folder';
        const expanded = isFolder && expandedHistoryFolders.has(entry.path);
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'history-row';
        row.style.setProperty('--history-depth', String(depth));
        row.setAttribute('role', 'treeitem');
        row.dataset.path = entry.path;
        if (isFolder) row.setAttribute('aria-expanded', String(expanded));
        if (entry.path === history.workspace.activePath) row.dataset.active = 'true';

        const twistie = document.createElement('span');
        twistie.className = `history-twistie codicon codicon-${isFolder ? (expanded ? 'chevron-down' : 'chevron-right') : 'blank'}`;
        const resourceIcon = document.createElement('span');
        resourceIcon.className = 'history-resource-icon';
        const resource = URI.parse(historyUri(history.sessionId!, entry.path, history.position).toString());
        resourceIcon.classList.add(...resourceIconClasses(resource, isFolder));

        const label = document.createElement('span');
        label.className = 'history-label';
        label.textContent = entry.name;
        const description = document.createElement('span');
        description.className = 'history-description';
        if (!isFolder) {
            description.textContent = `${entry.lines ?? 0} ${entry.lines === 1 ? 'line' : 'lines'}${entry.path === history.touchedPath ? '  ●' : ''}`;
        }

        row.append(twistie, resourceIcon, label, description);
        row.title = isFolder
            ? entry.path.replace(/^\//, '')
            : `${entry.path.replace(/^\//, '')} at event ${history.position}`;
        row.addEventListener('click', () => {
            if (isFolder) {
                if (expanded) expandedHistoryFolders.delete(entry.path);
                else expandedHistoryFolders.add(entry.path);
                renderHistory?.();
                return;
            }
            void vscode.commands.executeCommand(
                'vscode.open',
                historyUri(history.sessionId!, entry.path, history.position),
                { preview: true },
            );
        });
        tree.append(row);
        if (expanded) appendHistoryLevel(tree, history, entry.path, depth + 1);
    }
}

function resourceIconClasses(resource: URI, folder: boolean): string[] {
    try {
        return getIconClasses(
            StandaloneServices.get(IModelService),
            StandaloneServices.get(ILanguageService),
            resource,
            folder ? FileKind.FOLDER : FileKind.FILE,
        );
    } catch {
        return ['codicon', folder ? 'codicon-folder' : 'codicon-file-code'];
    }
}

function historyMessage(text: string, icon = 'info'): HTMLElement {
    const message = document.createElement('div');
    message.className = 'history-message';
    const glyph = document.createElement('span');
    glyph.className = `codicon codicon-${icon}`;
    const copy = document.createElement('span');
    copy.textContent = text;
    message.append(glyph, copy);
    return message;
}

function navigateHistoryTree(event: KeyboardEvent): void {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const rows = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('.history-row')];
    if (rows.length === 0) return;
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(rows.length - 1, current + 1)
            : Math.max(0, current - 1);
    event.preventDefault();
    rows[next]?.focus();
}

class DashboardPanel {
    private static current: DashboardPanel | null = null;
    private readonly panel: vscode.WebviewPanel;
    private readonly changeSubscription: vscode.Disposable;

    static show(model: ReplayController): void {
        if (DashboardPanel.current) {
            DashboardPanel.current.panel.reveal();
            DashboardPanel.current.post();
            return;
        }
        DashboardPanel.current = new DashboardPanel(model);
    }

    private constructor(private readonly model: ReplayController) {
        this.panel = vscode.window.createWebviewPanel(
            'lernumi.logInspector.dashboard',
            'Log Inspector',
            vscode.ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true },
        );
        this.panel.webview.html = webviewDocument(this.panel.webview, 'Log Inspector', dashboardCss, dashboardScript, '<div id="root"></div>');
        this.changeSubscription = model.onDidChange(() => this.post());
        this.panel.webview.onDidReceiveMessage((message: { type?: string; sessionId?: string; index?: number }) => {
            if (message.type === 'ready') this.post();
            if (message.type === 'selectSession' && message.sessionId) void model.select(message.sessionId);
            if (message.type === 'replayAt' && typeof message.index === 'number') void openReplay(model, message.index);
        });
        this.panel.onDidDispose(() => {
            this.changeSubscription.dispose();
            DashboardPanel.current = null;
        });
    }

    private post(): void {
        void this.panel.webview.postMessage({ type: 'state', state: this.model.dashboard() });
    }
}

async function openReplay(model: ReplayController, startAt?: number): Promise<void> {
    ReplayPanel.show(model);
    await StandaloneServices.get(IViewsService).openView(REPLAY_PANEL_VIEW_ID, true);
    replayTransport?.connect(model);
    replayTransport?.syncFromModel(startAt);
}

class ReplayPanel {
    private static current: ReplayPanel | null = null;
    private readonly panel: vscode.WebviewPanel;
    private ready = false;
    private pendingFrame: ReplayFrame | null = null;

    static show(model: ReplayController): void {
        if (ReplayPanel.current) {
            ReplayPanel.current.panel.reveal();
            return;
        }
        ReplayPanel.current = new ReplayPanel();
    }

    static showFrame(frame: ReplayFrame): void {
        ReplayPanel.current?.postFrame(frame);
    }

    private constructor() {
        this.panel = vscode.window.createWebviewPanel(
            'lernumi.logInspector.replay',
            'Replay',
            vscode.ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true },
        );
        const body = '<div class="label" id="label">Open the Replay panel to begin.</div><div class="code" id="code"></div>';
        this.panel.webview.html = webviewDocument(this.panel.webview, 'Replay', replayCss, replayScript, body);
        this.panel.webview.onDidReceiveMessage((message: { type?: string }) => {
            if (message.type !== 'ready') return;
            this.ready = true;
            if (this.pendingFrame) this.postFrame(this.pendingFrame);
        });
        this.panel.onDidDispose(() => {
            ReplayPanel.current = null;
        });
    }

    private postFrame(frame: ReplayFrame): void {
        this.pendingFrame = frame;
        if (this.ready) void this.panel.webview.postMessage({ type: 'frame', frame });
    }
}

function webviewDocument(
    webview: vscode.Webview,
    title: string,
    css: string,
    script: string,
    body: string,
): string {
    const nonce = randomNonce();
    const safeScript = script.replaceAll('</script', '<\\/script');
    return `<!doctype html><html lang="en"><head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style nonce="${nonce}">${css}</style><title>${title}</title>
    </head><body>${body}<script nonce="${nonce}">${safeScript}</script></body></html>`;
}

function randomNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}
