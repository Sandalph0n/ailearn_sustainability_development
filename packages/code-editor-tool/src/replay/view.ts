import type { IDisposable } from 'monaco-editor';
import {
    registerCustomView,
    ViewContainerLocation,
} from '@codingame/monaco-vscode-workbench-service-override';
import * as vscode from 'vscode';

import type { ReplayController } from './controller';
import dashboardCss from './webview/dashboard.css?raw';
import dashboardScript from './webview/dashboard.js?raw';
import replayCss from './webview/replay.css?raw';
import replayScript from './webview/replay.js?raw';

let controller: ReplayController | null = null;
let renderNavigation: (() => void) | null = null;

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
}

export function attachReplayController(value: ReplayController): void {
    controller = value;
    value.onDidChange(() => renderNavigation?.());
    renderNavigation?.();
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
        }, !state?.selectedSessionId || state.events.length === 0),
    );
    container.append(rows);

    const status = document.createElement('div');
    status.className = 'inspector-nav-status';
    if (!state || state.loading) status.textContent = 'Loading activity log…';
    else if (state.message) status.textContent = state.message;
    else if (state.selectedSessionId) status.textContent = `${state.events.length} events in selected session`;
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
