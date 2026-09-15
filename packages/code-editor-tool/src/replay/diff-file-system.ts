import * as vscode from 'vscode';

import type { ReplayFrame } from './controller';

export const REPLAY_DIFF_SCHEME = 'lernumi-replay-diff';
export const replayBeforeUri = vscode.Uri.from({
    scheme: REPLAY_DIFF_SCHEME,
    authority: 'before',
    path: '/Replay',
});
export const replayAfterUri = vscode.Uri.from({
    scheme: REPLAY_DIFF_SCHEME,
    authority: 'after',
    path: '/Replay',
});

/** Read-only backing documents for VS Code's native inline diff editor. */
export class ReplayDiffFileSystemProvider implements vscode.FileSystemProvider {
    private frame: ReplayFrame | null = null;
    private readonly changeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this.changeEmitter.event;

    setFrame(frame: ReplayFrame): void {
        this.frame = frame;
    }

    watch(): vscode.Disposable {
        return new vscode.Disposable(() => undefined);
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        const content = this.content(uri);
        return {
            type: vscode.FileType.File,
            ctime: 0,
            mtime: this.frame?.index ?? 0,
            size: new TextEncoder().encode(content).byteLength,
        };
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    readFile(uri: vscode.Uri): Uint8Array {
        return new TextEncoder().encode(this.content(uri));
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

    private content(uri: vscode.Uri): string {
        return uri.authority === replayBeforeUri.authority
            ? (this.frame?.previousContent ?? '')
            : (this.frame?.content ?? '');
    }
}
