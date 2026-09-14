import type {
    ReplayEvent,
    ReplaySelection,
    ReplayState,
    SequencedReplayEvent,
} from './types';

export function replayStateAt(
    events: readonly (ReplayEvent | SequencedReplayEvent)[],
    inclusiveIndex: number,
): ReplayState {
    const machine = new ReplayWorkspace();

    for (const value of events.slice(0, inclusiveIndex + 1)) {
        machine.apply(isSequencedEvent(value) ? value.event : value);
    }
    return machine.state;
}

export class ReplayWorkspace {
    readonly state: ReplayState = {
        files: new Map(),
        folders: new Map(),
        activePath: null,
        selections: [],
        visibleRange: null,
    };
    private readonly snapshots = new Map<string, { chunks: string[]; received: Set<number> }>();

    apply(event: ReplayEvent): ReplayState {
        applyReplayEvent(this.state, event, this.snapshots);
        return this.state;
    }
}

function isSequencedEvent(value: ReplayEvent | SequencedReplayEvent): value is SequencedReplayEvent {
    return (
        typeof value.sequence === 'number' &&
        typeof value.batchId === 'string' &&
        Boolean(value.event && typeof value.event === 'object')
    );
}

function applyReplayEvent(
    state: ReplayState,
    item: ReplayEvent,
    snapshots: Map<string, { chunks: string[]; received: Set<number> }>,
): void {
    const documentId = text(item.documentId);
    const path = text(item.path);
    switch (item.type) {
        case 'folder.snapshot':
        case 'folder.created':
            if (documentId && path) state.folders.set(documentId, { documentId, path });
            break;
        case 'file.created':
            if (documentId && path) state.files.set(documentId, { documentId, path, content: '', complete: true });
            break;
        case 'file.snapshot': {
            if (!documentId || !path || item.encoding !== 'utf-8') break;
            const chunkIndex = integer(item.chunkIndex) ?? 0;
            const chunkCount = integer(item.chunkCount) ?? 1;
            const snapshot = snapshots.get(documentId) ?? {
                chunks: Array.from<string>({ length: chunkCount }).fill(''),
                received: new Set<number>(),
            };
            snapshot.chunks[chunkIndex] = text(item.content) ?? '';
            snapshot.received.add(chunkIndex);
            snapshots.set(documentId, snapshot);
            state.files.set(documentId, {
                documentId,
                path,
                content: snapshot.chunks.join(''),
                complete: snapshot.received.size === chunkCount,
            });
            break;
        }
        case 'text.changed': {
            if (!documentId || !path) break;
            const current = state.files.get(documentId) ?? { documentId, path, content: '', complete: false };
            const changes = Array.isArray(item.changes) ? item.changes : [];
            let content = current.content;
            for (const change of [...changes].sort((a, b) => changeOffset(b) - changeOffset(a))) {
                if (!isChange(change)) continue;
                content = content.slice(0, change.rangeOffset) + change.text + content.slice(change.rangeOffset + change.rangeLength);
            }
            state.files.set(documentId, { ...current, path, content });
            break;
        }
        case 'file.renamed':
        case 'folder.renamed': {
            const fromPath = text(item.fromPath);
            const toPath = text(item.toPath);
            if (!fromPath || !toPath) break;
            renamePaths(state.files.values(), fromPath, toPath);
            renamePaths(state.folders.values(), fromPath, toPath);
            if (state.activePath === fromPath || state.activePath?.startsWith(`${fromPath}/`)) {
                state.activePath = `${toPath}${state.activePath.slice(fromPath.length)}`;
            }
            break;
        }
        case 'file.deleted':
            if (documentId) state.files.delete(documentId);
            break;
        case 'folder.deleted':
            if (path) {
                deleteWithin(state.files, path);
                deleteWithin(state.folders, path);
            }
            break;
        case 'editor.active':
            state.activePath = path;
            state.selections = [];
            state.visibleRange = null;
            break;
        case 'editor.selection':
            if (path && (!state.activePath || state.activePath === path)) {
                state.activePath = path;
                state.selections = selections(item.selections);
            }
            break;
        case 'editor.visible-range': {
            const top = integer(item.top);
            const bottom = integer(item.bottom);
            if (path && top !== null && bottom !== null) {
                state.activePath = path;
                state.visibleRange = { top, bottom };
            }
            break;
        }
    }
}

function renamePaths(items: Iterable<{ path: string }>, fromPath: string, toPath: string): void {
    for (const item of items) {
        if (item.path === fromPath || item.path.startsWith(`${fromPath}/`)) {
            item.path = `${toPath}${item.path.slice(fromPath.length)}`;
        }
    }
}

function deleteWithin<T extends { path: string }>(items: Map<string, T>, path: string): void {
    for (const [id, item] of items) {
        if (item.path === path || item.path.startsWith(`${path}/`)) items.delete(id);
    }
}

function selections(value: unknown): ReplaySelection[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ReplaySelection => {
        if (!item || typeof item !== 'object') return false;
        const selection = item as Record<string, unknown>;
        return isPosition(selection.anchor) && isPosition(selection.active);
    });
}

function isPosition(value: unknown): value is { line: number; character: number } {
    if (!value || typeof value !== 'object') return false;
    const position = value as Record<string, unknown>;
    return integer(position.line) !== null && integer(position.character) !== null;
}

function text(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function integer(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function isChange(value: unknown): value is { rangeOffset: number; rangeLength: number; text: string } {
    if (!value || typeof value !== 'object') return false;
    const item = value as Record<string, unknown>;
    return integer(item.rangeOffset) !== null && integer(item.rangeLength) !== null && typeof item.text === 'string';
}

function changeOffset(value: unknown): number {
    return isChange(value) ? value.rangeOffset : -1;
}
