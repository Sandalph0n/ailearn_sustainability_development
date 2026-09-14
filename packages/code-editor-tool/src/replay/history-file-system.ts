import * as vscode from 'vscode';

import type { ReplayController } from './controller';
import { historyChildren, normalizePath } from './history-tree';

export const HISTORY_SCHEME = 'lernumi-history';

export function historyUri(sessionId: string, path: string, position: number): vscode.Uri {
    return vscode.Uri.from({
        scheme: HISTORY_SCHEME,
        authority: sessionId,
        path: normalizePath(path),
        query: `at=${position}`,
    });
}

export class HistoryFileSystemProvider implements vscode.FileSystemProvider {
    private readonly changeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this.changeEmitter.event;

    constructor(private readonly controller: ReplayController) {}

    watch(): vscode.Disposable {
        return new vscode.Disposable(() => undefined);
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        const { sessionId, path, position } = parseHistoryUri(uri);
        const workspace = this.controller.workspaceAt(sessionId, position);
        if (!workspace) throw vscode.FileSystemError.Unavailable('The recorded session is no longer loaded.');
        if (path === '/') return directoryStat(position);

        const file = [...workspace.files.values()].find((candidate) => normalizePath(candidate.path) === path);
        const isFolder = [...workspace.folders.values()].some((candidate) => normalizePath(candidate.path) === path)
            || hasDescendants(workspace, path);
        if (isFolder) return directoryStat(position);
        if (file) return fileStat(file.content, position);
        throw vscode.FileSystemError.FileNotFound(uri);
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        const { sessionId, path, position } = parseHistoryUri(uri);
        const workspace = this.controller.workspaceAt(sessionId, position);
        if (!workspace) throw vscode.FileSystemError.Unavailable('The recorded session is no longer loaded.');
        return historyChildren(workspace, path).map((entry) => [
            entry.name,
            entry.kind === 'folder' ? vscode.FileType.Directory : vscode.FileType.File,
        ]);
    }

    readFile(uri: vscode.Uri): Uint8Array {
        const { sessionId, path, position } = parseHistoryUri(uri);
        const workspace = this.controller.workspaceAt(sessionId, position);
        if (!workspace) throw vscode.FileSystemError.Unavailable('The recorded session is no longer loaded.');
        const file = [...workspace.files.values()].find((candidate) => normalizePath(candidate.path) === path);
        if (!file) throw vscode.FileSystemError.FileNotFound(uri);
        return new TextEncoder().encode(file.content);
    }

    createDirectory(uri: vscode.Uri): void {
        throw vscode.FileSystemError.NoPermissions(uri);
    }

    writeFile(uri: vscode.Uri): void {
        throw vscode.FileSystemError.NoPermissions(uri);
    }

    delete(uri: vscode.Uri): void {
        throw vscode.FileSystemError.NoPermissions(uri);
    }

    rename(oldUri: vscode.Uri): void {
        throw vscode.FileSystemError.NoPermissions(oldUri);
    }
}

function parseHistoryUri(uri: vscode.Uri): { sessionId: string; path: string; position: number } {
    const rawPosition = Number(new URLSearchParams(uri.query).get('at') ?? '0');
    return {
        sessionId: uri.authority,
        path: normalizePath(uri.path),
        position: Number.isInteger(rawPosition) && rawPosition >= 0 ? rawPosition : 0,
    };
}

function hasDescendants(workspace: ReturnType<ReplayController['history']>['workspace'], path: string): boolean {
    const prefix = `${path}/`;
    return [...workspace.files.values(), ...workspace.folders.values()]
        .some((entry) => normalizePath(entry.path).startsWith(prefix));
}

function directoryStat(position: number): vscode.FileStat {
    return { type: vscode.FileType.Directory, ctime: 0, mtime: position, size: 0 };
}

function fileStat(content: string, position: number): vscode.FileStat {
    return {
        type: vscode.FileType.File,
        ctime: 0,
        mtime: position,
        size: new TextEncoder().encode(content).byteLength,
    };
}
