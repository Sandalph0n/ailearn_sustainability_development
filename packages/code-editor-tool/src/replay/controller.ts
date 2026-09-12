import * as vscode from 'vscode';

import type { ToolApiClient } from '../platform/client';
import type { EventRecorder } from '../platform/event-recorder';
import type { ReplaySession, ToolEvent } from '../platform/types';
import { replayStateAt } from './state';

export type ReplayViewState = {
    sessions: ReplaySession[];
    selectedSessionId: string | null;
    events: ToolEvent[];
    step: number;
    playing: boolean;
    loading: boolean;
    message: string | null;
};

export class ReplayController {
    private readonly emitter = new vscode.EventEmitter<void>();
    readonly onDidChange = this.emitter.event;
    private readonly contentEmitter = new vscode.EventEmitter<vscode.Uri>();
    private readonly content = new Map<string, string>();
    private timer: number | undefined;
    private state: ReplayViewState = {
        sessions: [],
        selectedSessionId: null,
        events: [],
        step: -1,
        playing: false,
        loading: false,
        message: null,
    };

    constructor(
        private readonly api: ToolApiClient,
        private readonly recorder: EventRecorder,
    ) {
        vscode.workspace.registerTextDocumentContentProvider('ailearn-replay', {
            onDidChange: this.contentEmitter.event,
            provideTextDocumentContent: (uri) => this.content.get(uri.toString()) ?? '',
        });
    }

    snapshot(): ReplayViewState {
        return { ...this.state, sessions: [...this.state.sessions], events: [...this.state.events] };
    }

    async refresh(): Promise<void> {
        this.patch({ loading: true, message: null });
        try {
            await this.recorder.flush();
            this.patch({ sessions: await this.api.listReplaySessions(), loading: false });
        } catch (error) {
            this.patch({ loading: false, message: message(error) });
        }
    }

    async select(sessionId: string): Promise<void> {
        this.pause();
        this.patch({ selectedSessionId: sessionId, events: [], step: -1, loading: true, message: null });
        try {
            const batches = await this.api.replayEvents(sessionId);
            const events = batches.flatMap((batch) => batch.events).filter(isToolEvent);
            this.patch({ events, step: events.length ? 0 : -1, loading: false });
            if (events.length) await this.showStep(0);
        } catch (error) {
            this.patch({ loading: false, message: message(error) });
        }
    }

    async showStep(step: number): Promise<void> {
        if (this.state.events.length === 0) return;
        const safeStep = Math.min(Math.max(step, 0), this.state.events.length - 1);
        this.patch({ step: safeStep });
        const state = replayStateAt(this.state.events, safeStep);
        const path = state.activePath ?? [...state.files.values()].at(-1)?.path ?? null;
        if (!path) return;
        const file = [...state.files.values()].find((candidate) => candidate.path === path);
        if (!file) return;

        const uri = vscode.Uri.from({
            scheme: 'ailearn-replay',
            authority: this.state.selectedSessionId ?? 'session',
            path: file.path,
        });
        this.content.set(uri.toString(), file.content);
        this.contentEmitter.fire(uri);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, { preview: false, preserveFocus: false });
    }

    play(): void {
        if (this.state.playing || this.state.events.length === 0) return;
        this.patch({ playing: true });
        this.timer = window.setInterval(() => {
            const next = this.state.step + 1;
            if (next >= this.state.events.length) {
                this.pause();
                return;
            }
            void this.showStep(next);
        }, 350);
    }

    pause(): void {
        window.clearInterval(this.timer);
        if (this.state.playing) this.patch({ playing: false });
    }

    private patch(next: Partial<ReplayViewState>): void {
        this.state = { ...this.state, ...next };
        this.emitter.fire();
    }
}

function isToolEvent(value: unknown): value is ToolEvent {
    return Boolean(
        value &&
        typeof value === 'object' &&
        (value as Record<string, unknown>).schema === 1 &&
        typeof (value as Record<string, unknown>).type === 'string',
    );
}

function message(error: unknown): string {
    return error instanceof Error ? error.message : 'Replay data could not be loaded';
}
