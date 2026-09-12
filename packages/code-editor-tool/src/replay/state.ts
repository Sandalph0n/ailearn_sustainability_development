import type { ToolEvent } from '../platform/types';

export type ReplayFile = {
    documentId: string;
    path: string;
    content: string;
    complete: boolean;
};

export type ReplayState = {
    files: Map<string, ReplayFile>;
    activePath: string | null;
};

export function replayStateAt(events: ToolEvent[], inclusiveIndex: number): ReplayState {
    const state: ReplayState = { files: new Map(), activePath: null };
    const snapshots = new Map<string, string[]>();

    for (const item of events.slice(0, inclusiveIndex + 1)) {
        const documentId = text(item.documentId);
        const path = text(item.path);
        switch (item.type) {
            case 'file.created':
                if (documentId && path) state.files.set(documentId, { documentId, path, content: '', complete: true });
                break;
            case 'file.snapshot': {
                if (!documentId || !path || item.encoding !== 'utf-8') break;
                const chunkIndex = number(item.chunkIndex) ?? 0;
                const chunkCount = number(item.chunkCount) ?? 1;
                const chunks = snapshots.get(documentId) ?? Array.from<string>({ length: chunkCount }).fill('');
                chunks[chunkIndex] = text(item.content) ?? '';
                snapshots.set(documentId, chunks);
                state.files.set(documentId, {
                    documentId,
                    path,
                    content: chunks.join(''),
                    complete: chunks.every((chunk) => chunk !== '') || (chunkCount === 1 && chunks[0] === ''),
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
                for (const file of state.files.values()) {
                    if (file.path === fromPath || file.path.startsWith(`${fromPath}/`)) {
                        file.path = `${toPath}${file.path.slice(fromPath.length)}`;
                    }
                }
                break;
            }
            case 'file.deleted':
                if (documentId) state.files.delete(documentId);
                break;
            case 'folder.deleted':
                if (path) {
                    for (const [id, file] of state.files) {
                        if (file.path === path || file.path.startsWith(`${path}/`)) state.files.delete(id);
                    }
                }
                break;
            case 'editor.active':
                state.activePath = path;
                break;
        }
    }
    return state;
}

function text(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function number(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isChange(value: unknown): value is { rangeOffset: number; rangeLength: number; text: string } {
    if (!value || typeof value !== 'object') return false;
    const item = value as Record<string, unknown>;
    return number(item.rangeOffset) !== null && number(item.rangeLength) !== null && typeof item.text === 'string';
}

function changeOffset(value: unknown): number {
    return isChange(value) ? value.rangeOffset : -1;
}
