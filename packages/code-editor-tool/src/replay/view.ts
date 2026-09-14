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
import * as vscode from 'vscode';

import type { ReplayController } from './controller';
import { HISTORY_SCHEME, HistoryFileSystemProvider, historyUri } from './history-file-system';
import { historyChildren } from './history-tree';
import dashboardCss from './webview/dashboard.css?raw';
import dashboardScript from './webview/dashboard.js?raw';
import replayCss from './webview/replay.css?raw';
import replayScript from './webview/replay.js?raw';

let controller: ReplayController | null = null;
let renderNavigation: (() => void) | null = null;
let renderHistory: (() => void) | null = null;
let historyPlayheadThrottle: ReturnType<typeof setTimeout> | null = null;
const expandedHistoryFolders = new Set<string>();

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
    });
    value.onDidChangePlayhead(() => {
        if (historyPlayheadThrottle) return;
        historyPlayheadThrottle = setTimeout(() => {
            historyPlayheadThrottle = null;
            renderHistory?.();
        }, 250);
    });
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
            if (controller) DashboardPanel.show(controller);
        }),
        navigationRow('play-circle', 'Replay', 'Watch the code being written', () => {
            if (controller) ReplayPanel.show(controller);
        }, !state?.selectedSessionId),
    );
    container.append(rows);

    const status = document.createElement('div');
    status.className = 'inspector-nav-status';
    if (!state || state.loading) status.textContent = 'Loading activity log…';
    else if (state.message) status.textContent = state.message;
    else if (state.selectedSessionId) {
        const count = controller?.history().total ?? 0;
        status.textContent = `${count} activity ${count === 1 ? 'event' : 'events'} in selected session`;
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
            if (message.type === 'replayAt' && typeof message.index === 'number') ReplayPanel.show(model, message.index);
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

class ReplayPanel {
    private static current: ReplayPanel | null = null;
    private readonly panel: vscode.WebviewPanel;
    private readonly changeSubscription: vscode.Disposable;
    private startAt: number | undefined;

    static show(model: ReplayController, startAt?: number): void {
        if (ReplayPanel.current) {
            ReplayPanel.current.panel.reveal();
            if (startAt !== undefined) ReplayPanel.current.jump(startAt);
            return;
        }
        ReplayPanel.current = new ReplayPanel(model, startAt);
    }

    private constructor(private readonly model: ReplayController, startAt?: number) {
        this.startAt = startAt;
        this.panel = vscode.window.createWebviewPanel(
            'lernumi.logInspector.replay',
            'Replay',
            vscode.ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true },
        );
        const body = `<div class="transport">
            <button id="play">▶&nbsp;&nbsp;Play</button>
            <div class="scrub"><div class="marks" id="marks"></div><input type="range" id="range" min="0" max="0" value="0"></div>
            <span class="clock" id="clock">0 / 0</span>
            <div class="speed-wrap">
                <button class="ghost" id="speedButton" title="Playback speed">1×</button>
                <div class="speed-popup" id="speedPopup" hidden>
                    <input type="range" id="speedSlider" min="0" max="100" value="50">
                    <div class="speed-ends"><span>0.1×</span><span>10×</span></div>
                    <div class="speed-presets" id="speedPresets"></div>
                    <label class="speed-custom">Custom<input type="number" id="speedCustom" min="0.05" max="20" step="0.05"><span>×</span></label>
                    <div class="speed-note">1× plays back at exactly the speed the student worked — including the pauses.</div>
                </div>
            </div>
            <select id="file" title="File shown"><option value="">(follow the edit)</option></select>
            <button class="ghost" id="jump" title="Jump to the next notable event">Next flag ⚑</button>
        </div><div class="label" id="label">Start</div><div class="code" id="code"></div>`;
        this.panel.webview.html = webviewDocument(this.panel.webview, 'Replay', replayCss, replayScript, body);
        this.changeSubscription = model.onDidChange(() => this.initialize());
        this.panel.webview.onDidReceiveMessage((message: { type?: string; index?: number; file?: string | null }) => {
            if (message.type === 'ready') this.initialize();
            if (message.type === 'seek') this.postFrame(message.index ?? 0, message.file ?? null);
        });
        this.panel.onDidDispose(() => {
            this.changeSubscription.dispose();
            ReplayPanel.current = null;
        });
    }

    private initialize(): void {
        const state = this.model.snapshot();
        if (state.message) {
            void this.panel.webview.postMessage({ type: 'error', message: state.message });
            return;
        }
        if (!state.selectedSessionId || state.events.length === 0) {
            if (!state.loading) void this.panel.webview.postMessage({ type: 'error', message: 'No recorded events are available.' });
            return;
        }
        void this.panel.webview.postMessage({ type: 'init', outline: this.model.outline(), startAt: this.startAt });
        this.startAt = undefined;
    }

    private postFrame(index: number, file: string | null): void {
        this.model.seek(index);
        void this.panel.webview.postMessage({ type: 'frame', frame: this.model.frame(index, file) });
    }

    private jump(eventIndex: number): void {
        void this.panel.webview.postMessage({ type: 'jumpTo', index: eventIndex + 1 });
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
