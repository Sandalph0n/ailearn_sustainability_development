import * as vscode from 'vscode';
import {
    flattenReplayBatches,
    replayStateAt,
    verifyReplayRecording,
    type ReplayIntegrity,
    type ReplaySelection,
    type ReplayState,
    type SequencedReplayEvent,
} from '@lernumi/replay-core';

import type { ToolApiClient } from '../platform/client';
import type { EventRecorder } from '../platform/event-recorder';
import type { ReplaySession } from '../platform/types';
import {
    buildCombinedReplayTimeline,
    buildReplayTimeline,
    replayCutoff,
    type ReplayTimeline,
} from './timeline';

export type ReplayViewState = {
    sessions: ReplaySession[];
    scope: 'all' | 'session';
    selectedSessionId: string | null;
    events: SequencedReplayEvent[];
    loading: boolean;
    integrity: ReplayIntegrity | null;
    message: string | null;
};

export type ReplayOutlineItem = {
    at: number;
    notable: boolean;
    type: string;
    sessionId: string;
};

export type ReplayFrame = {
    index: number;
    total: number;
    at: number;
    file: string | null;
    files: string[];
    label: string;
    notable: boolean;
    content: string;
    change: { offset: number; length: number } | null;
    selection: [number, number][];
};

export type ReplayFlag = {
    index: number;
    at: number;
    type: string;
    file: string | null;
    size: number | null;
    lines: number | null;
};

export type ReplayDashboardState = {
    found: boolean;
    loading: boolean;
    message: string | null;
    selectedSessionId: string | null;
    integrity: ReplayIntegrity | null;
    sessions: ReplaySession[];
    events: number;
    batches: number;
    checkpoints: number;
    externalPastes: number;
    flags: ReplayFlag[];
};

export type ReplayHistoryState = {
    sessionId: string | null;
    position: number;
    total: number;
    at: number;
    touchedPath: string | null;
    workspace: ReplayState;
};

/**
 * Shared replay model for every inspector surface.
 *
 * Network loading and deterministic reconstruction stay here. Webviews only render a frame and
 * send navigation intents, matching the boundary used by MQ Smart Learning's Log Inspector.
 */
export class ReplayController {
    private readonly emitter = new vscode.EventEmitter<void>();
    readonly onDidChange = this.emitter.event;
    private readonly playheadEmitter = new vscode.EventEmitter<void>();
    readonly onDidChangePlayhead = this.playheadEmitter.event;
    private readonly timelinesBySession = new Map<string, ReplayTimeline>();
    private allTimeline: ReplayTimeline = buildReplayTimeline([]);
    private playhead = 0;
    private state: ReplayViewState = {
        sessions: [],
        scope: 'all',
        selectedSessionId: null,
        events: [],
        loading: false,
        integrity: null,
        message: null,
    };

    constructor(
        private readonly api: ToolApiClient,
        private readonly recorder: EventRecorder,
        private readonly preferredSessionId: string | null = null,
    ) {}

    snapshot(): ReplayViewState {
        return { ...this.state, sessions: [...this.state.sessions], events: [...this.state.events] };
    }

    async refresh(): Promise<void> {
        this.patch({ loading: true, message: null });
        try {
            await this.recorder.flush();
            const sessions = await this.api.listReplaySessions();
            this.patch({ sessions, loading: false });
            if (sessions.length === 0) {
                this.allTimeline = buildReplayTimeline([]);
                this.patch({ scope: 'all', selectedSessionId: null, events: [], integrity: null });
                return;
            }

            if (this.state.scope === 'session') {
                const selected =
                    (this.state.selectedSessionId && sessions.some((item) => item.id === this.state.selectedSessionId)
                        ? this.state.selectedSessionId
                        : null)
                    ?? (this.preferredSessionId && sessions.some((item) => item.id === this.preferredSessionId)
                        ? this.preferredSessionId
                        : null)
                    ?? sessions[0]!.id;
                await this.select(selected);
            } else {
                await this.selectAll();
            }
        } catch (error) {
            this.patch({ loading: false, message: errorMessage(error) });
        }
    }

    async select(sessionId: string): Promise<void> {
        this.setPlayhead(0);
        this.patch({ scope: 'session', selectedSessionId: sessionId, events: [], loading: true, integrity: null, message: null });
        try {
            const batches = await this.api.replayEvents(sessionId);
            const integrity = await verifyReplayRecording(sessionId, batches);
            const events = flattenReplayBatches(batches);
            this.timelinesBySession.set(sessionId, buildReplayTimeline(events, sessionId));
            this.patch({ events, loading: false, integrity });
        } catch (error) {
            this.patch({ loading: false, message: errorMessage(error) });
        }
    }

    async selectAll(): Promise<void> {
        this.setPlayhead(0);
        this.patch({ scope: 'all', selectedSessionId: null, events: [], loading: true, integrity: null, message: null });
        try {
            const ordered = [...this.state.sessions].sort((left, right) =>
                Date.parse(left.startedAt) - Date.parse(right.startedAt) || left.id.localeCompare(right.id),
            );
            const loaded = await mapWithConcurrency(ordered, 4, async (session) => {
                const batches = await this.api.replayEvents(session.id);
                const integrity = await verifyReplayRecording(session.id, batches);
                const events = flattenReplayBatches(batches);
                const timeline = buildReplayTimeline(events, session.id);
                this.timelinesBySession.set(session.id, timeline);
                return { session, events, integrity };
            });
            this.allTimeline = buildCombinedReplayTimeline(loaded.map(({ session, events }) => ({
                sessionId: session.id,
                events,
            })));
            this.patch({
                events: [...this.allTimeline.allEvents],
                loading: false,
                integrity: combinedIntegrity(loaded.map((item) => item.integrity)),
            });
        } catch (error) {
            this.patch({ loading: false, message: errorMessage(error) });
        }
    }

    outline(): ReplayOutlineItem[] {
        const timeline = this.timeline();
        return timeline.events.map((item, index) => ({
            at: timestamp(item),
            notable: isNotable(item),
            type: item.event.type,
            sessionId: timeline.eventSessionIds[index]!,
        }));
    }

    frame(position: number, pinnedFile: string | null = null): ReplayFrame {
        const timeline = this.timeline();
        const index = Math.max(0, Math.min(position, timeline.events.length));
        const state = replayStateAt(timeline.allEvents, replayCutoff(timeline, index));
        const current = index > 0 ? timeline.events[index - 1] : undefined;
        const eventPath = current ? eventFile(current) : null;
        const file = pinnedFile
            ?? eventPath
            ?? state.activePath
            ?? [...state.files.values()].at(-1)?.path
            ?? null;
        const replayFile = file
            ? [...state.files.values()].find((candidate) => candidate.path === file)
            : undefined;
        const content = replayFile?.content ?? '';

        return {
            index,
            total: timeline.events.length,
            at: current ? timestamp(current) : (this.outline()[0]?.at ?? 0),
            file,
            files: [...state.files.values()].map((item) => item.path).sort(),
            label: current ? describe(current) : 'Start',
            notable: current ? isNotable(current) : false,
            content,
            change: current ? changedRange(current) : null,
            selection: file && state.activePath === file ? selectionOffsets(content, state.selections) : [],
        };
    }

    seek(position: number): void {
        this.setPlayhead(Math.max(0, Math.min(position, this.timeline().events.length)));
    }

    history(): ReplayHistoryState {
        const timeline = this.timeline();
        const current = this.playhead > 0 ? timeline.events[this.playhead - 1] : undefined;
        return {
            sessionId: this.scopeKey(),
            position: this.playhead,
            total: timeline.events.length,
            at: current ? timestamp(current) : 0,
            touchedPath: current ? eventFile(current) : null,
            workspace: replayStateAt(timeline.allEvents, replayCutoff(timeline, this.playhead)),
        };
    }

    workspaceAt(sessionId: string, position: number): ReplayState | null {
        const timeline = sessionId === 'all' ? this.allTimeline : this.timelinesBySession.get(sessionId);
        if (!timeline) return null;
        return replayStateAt(timeline.allEvents, replayCutoff(timeline, position));
    }

    dashboard(): ReplayDashboardState {
        const timeline = this.timeline();
        const flags = timeline.events
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => isNotable(item))
            .map(({ item, index }): ReplayFlag => ({
                index,
                at: timestamp(item),
                type: item.event.type,
                file: eventFile(item),
                size: finiteNumber(item.event.length),
                lines: finiteNumber(item.event.lineCount),
            }));
        const session = this.state.sessions.find((item) => item.id === this.state.selectedSessionId);

        return {
            found: this.state.sessions.length > 0,
            loading: this.state.loading,
            message: this.state.message,
            selectedSessionId: this.state.selectedSessionId,
            integrity: this.state.integrity,
            sessions: [...this.state.sessions],
            events: timeline.events.length,
            batches: session?.eventBatchCount
                ?? this.state.sessions.reduce((total, item) => total + item.eventBatchCount, 0),
            checkpoints: this.state.integrity?.checkedCheckpoints ?? 0,
            externalPastes: timeline.events.filter((item) => item.event.type === 'editor.paste').length,
            flags,
        };
    }

    private patch(next: Partial<ReplayViewState>): void {
        this.state = { ...this.state, ...next };
        this.emitter.fire();
    }

    private setPlayhead(position: number): void {
        if (this.playhead === position) return;
        this.playhead = position;
        this.playheadEmitter.fire();
    }

    private timeline(): ReplayTimeline {
        return this.state.scope === 'all'
            ? this.allTimeline
            : this.state.selectedSessionId
              ? (this.timelinesBySession.get(this.state.selectedSessionId) ?? buildReplayTimeline([]))
              : buildReplayTimeline([]);
    }

    private scopeKey(): string | null {
        if (this.state.sessions.length === 0) return null;
        return this.state.scope === 'all' ? 'all' : this.state.selectedSessionId;
    }
}

async function mapWithConcurrency<T, R>(
    items: readonly T[],
    concurrency: number,
    mapper: (item: T) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await mapper(items[index]!);
        }
    });
    await Promise.all(workers);
    return results;
}

function combinedIntegrity(items: readonly ReplayIntegrity[]): ReplayIntegrity | null {
    if (items.length === 0) return null;
    const severity = { VERIFIED: 0, LEGACY: 1, GAP: 2, INVALID: 3 } as const;
    const worst = [...items].sort((left, right) => severity[right.status] - severity[left.status])[0]!;
    return {
        ...worst,
        checkedBatches: items.reduce((total, item) => total + item.checkedBatches, 0),
        checkedEvents: items.reduce((total, item) => total + item.checkedEvents, 0),
        checkedCheckpoints: items.reduce((total, item) => total + item.checkedCheckpoints, 0),
        message: `${items.length} sessions checked. ${worst.message}`,
    };
}

function changedRange(item: SequencedReplayEvent): { offset: number; length: number } | null {
    if (item.event.type !== 'text.changed' || !Array.isArray(item.event.changes)) return null;
    const changes = item.event.changes.filter((change): change is Record<string, unknown> =>
        Boolean(change && typeof change === 'object'),
    );
    if (changes.length === 0) return null;
    const first = changes[0]!;
    const offset = finiteNumber(first.rangeOffset);
    const text = typeof first.text === 'string' ? first.text : '';
    return offset === null ? null : { offset, length: text.length };
}

function selectionOffsets(content: string, selections: ReplaySelection[]): [number, number][] {
    const lineOffsets = [0];
    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') lineOffsets.push(index + 1);
    }
    const offset = (position: { line: number; character: number }) =>
        Math.min(content.length, (lineOffsets[position.line] ?? content.length) + position.character);
    return selections.map((selection) => [offset(selection.anchor), offset(selection.active)]);
}

function isNotable(item: SequencedReplayEvent): boolean {
    return item.event.type === 'editor.paste';
}

function eventFile(item: SequencedReplayEvent): string | null {
    const value = item.event.path ?? item.event.toPath ?? item.event.fromPath;
    return typeof value === 'string' ? value : null;
}

function describe(item: SequencedReplayEvent): string {
    const path = eventFile(item)?.replace(/^\//, '') ?? '';
    switch (item.event.type) {
        case 'file.snapshot': return `Opened initial snapshot${path ? ` — ${path}` : ''}`;
        case 'folder.snapshot': return `Found folder${path ? ` — ${path}` : ''}`;
        case 'file.created': return `Created file${path ? ` — ${path}` : ''}`;
        case 'folder.created': return `Created folder${path ? ` — ${path}` : ''}`;
        case 'file.deleted': return `Deleted file${path ? ` — ${path}` : ''}`;
        case 'folder.deleted': return `Deleted folder${path ? ` — ${path}` : ''}`;
        case 'file.renamed': return `Renamed file — ${String(item.event.fromPath ?? '')} → ${String(item.event.toPath ?? '')}`;
        case 'folder.renamed': return `Renamed folder — ${String(item.event.fromPath ?? '')} → ${String(item.event.toPath ?? '')}`;
        case 'file.save-requested': return `Saving${path ? ` — ${path}` : ''}`;
        case 'file.saved': return `Saved${path ? ` — ${path}` : ''}`;
        case 'text.changed': return `Edited${path ? ` — ${path}` : ''}`;
        case 'editor.active': return `Focused${path ? ` — ${path}` : ''}`;
        case 'editor.selection': return `Changed selection${path ? ` — ${path}` : ''}`;
        case 'editor.visible-range': return `Scrolled${path ? ` — ${path}` : ''}`;
        case 'editor.paste': return `Paste from outside — ${finiteNumber(item.event.length) ?? 0} characters${path ? ` — ${path}` : ''}`;
        case 'session.started': return 'Recording started';
        case 'session.ended': return 'Recording ended';
        default: return item.event.type;
    }
}

function timestamp(item: SequencedReplayEvent): number {
    const eventTime = Date.parse(item.event.at);
    return Number.isFinite(eventTime) ? eventTime : Date.parse(item.receivedAt);
}

function finiteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Replay data could not be loaded';
}
