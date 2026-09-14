import type { ReplayState } from '@lernumi/replay-core';

export type HistoryEntry = {
    kind: 'file' | 'folder';
    name: string;
    path: string;
    lines: number | null;
};

/** Return one directory level from a reconstructed replay workspace. */
export function historyChildren(state: ReplayState, parentPath = '/'): HistoryEntry[] {
    const parent = normalizePath(parentPath);
    const prefix = parent === '/' ? '/' : `${parent}/`;
    const folders = new Map<string, string>();
    const files = new Map<string, { path: string; lines: number }>();

    for (const folder of state.folders.values()) {
        collect(folder.path, true, null);
    }
    for (const file of state.files.values()) {
        collect(file.path, false, file.content.split('\n').length);
    }

    // A path with descendants is a directory even when an old recording also contains a file
    // entry at that path.
    for (const name of folders.keys()) files.delete(name);

    return [
        ...[...folders].map(([name, path]) => ({ kind: 'folder' as const, name, path, lines: null })),
        ...[...files].map(([name, value]) => ({ kind: 'file' as const, name, ...value })),
    ].sort((left, right) =>
        Number(right.kind === 'folder') - Number(left.kind === 'folder')
        || left.name.localeCompare(right.name),
    );

    function collect(value: string, explicitFolder: boolean, lines: number | null): void {
        const path = normalizePath(value);
        if (path === parent || !path.startsWith(prefix)) return;
        const remainder = path.slice(prefix.length);
        const slash = remainder.indexOf('/');
        if (slash >= 0) {
            const name = remainder.slice(0, slash);
            folders.set(name, joinPath(parent, name));
            return;
        }
        if (explicitFolder) folders.set(remainder, path);
        else if (lines !== null) files.set(remainder, { path, lines });
    }
}

export function normalizePath(value: string): string {
    const normalized = `/${value}`.replaceAll('\\', '/').replace(/\/{2,}/g, '/');
    return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
}

function joinPath(parent: string, name: string): string {
    return normalizePath(`${parent}/${name}`);
}
