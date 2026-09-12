import type { IDisposable } from 'monaco-editor';
import {
    registerCustomView,
    ViewContainerLocation,
} from '@codingame/monaco-vscode-workbench-service-override';

import type { ReplayController, ReplayViewState } from './controller';

let controller: ReplayController | null = null;
let renderCurrent: (() => void) | null = null;

export function registerReplayView(): void {
    registerCustomView({
        id: 'lernumi.replay',
        name: 'Replay',
        order: 20,
        default: false,
        location: ViewContainerLocation.Sidebar,
        icon: new URL('../assets/replay.svg', import.meta.url).toString(),
        actions: [
            {
                id: 'lernumi.replay.refresh',
                title: 'Refresh sessions',
                tooltip: 'Refresh replay sessions',
                icon: 'refresh',
                async run() {
                    await controller?.refresh();
                },
            },
        ],
        renderBody(container): IDisposable {
            container.classList.add('lernumi-replay-view');
            const render = () => renderReplay(container, controller?.snapshot() ?? emptyState());
            renderCurrent = render;
            const subscription = controller?.onDidChange(render);
            render();
            return {
                dispose() {
                    subscription?.dispose();
                    if (renderCurrent === render) renderCurrent = null;
                },
            };
        },
    });
}

export function attachReplayController(value: ReplayController): void {
    controller = value;
    value.onDidChange(() => renderCurrent?.());
    renderCurrent?.();
    void value.refresh();
}

function renderReplay(container: HTMLElement, state: ReplayViewState): void {
    container.replaceChildren();
    const intro = element('p', 'replay-intro', 'Sessions recorded for this assessment workspace and tool version.');
    container.append(intro);

    if (state.loading) container.append(element('p', 'replay-message', 'Loading replay data…'));
    if (state.message) container.append(element('p', 'replay-message replay-error', state.message));

    const sessions = element('div', 'replay-sessions');
    for (const session of state.sessions) {
        const button = element('button', 'replay-session') as HTMLButtonElement;
        button.type = 'button';
        button.dataset.active = String(session.id === state.selectedSessionId);
        button.disabled = !session.currentRuntimeCompatible;
        button.append(
            element('span', 'replay-session-title', new Date(session.startedAt).toLocaleString()),
            element(
                'span',
                'replay-session-meta',
                session.currentRuntimeCompatible
                    ? `${session.checkpoint + 1} events · ${session.endedAt ? 'Closed' : 'Open'}`
                    : `Requires tool ${session.toolVersion?.version ?? 'unknown'}`,
            ),
        );
        button.addEventListener('click', () => void controller?.select(session.id));
        sessions.append(button);
    }
    if (!state.loading && state.sessions.length === 0) {
        sessions.append(element('p', 'replay-message', 'No recorded sessions yet.'));
    }
    container.append(sessions);

    if (state.selectedSessionId && state.events.length > 0) {
        const controls = element('div', 'replay-controls');
        const toggle = element('button', 'replay-control', state.playing ? 'Pause' : 'Play') as HTMLButtonElement;
        toggle.type = 'button';
        toggle.addEventListener('click', () => state.playing ? controller?.pause() : controller?.play());
        const range = document.createElement('input');
        range.className = 'replay-range';
        range.type = 'range';
        range.min = '0';
        range.max = String(state.events.length - 1);
        range.value = String(Math.max(0, state.step));
        range.setAttribute('aria-label', 'Replay position');
        range.addEventListener('input', () => void controller?.showStep(Number(range.value)));
        controls.append(toggle, range, element('span', 'replay-position', `${state.step + 1} / ${state.events.length}`));
        container.append(controls);
    }
}

function element(tag: string, className: string, text = ''): HTMLElement {
    const result = document.createElement(tag);
    result.className = className;
    result.textContent = text;
    return result;
}

function emptyState(): ReplayViewState {
    return { sessions: [], selectedSessionId: null, events: [], step: -1, playing: false, loading: false, message: null };
}
