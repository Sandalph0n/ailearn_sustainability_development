import { Emitter, Event } from '@codingame/monaco-vscode-api/vscode/vs/base/common/event';
import type { IDisposable } from '@codingame/monaco-vscode-api/vscode/vs/base/common/lifecycle';
import { URI } from '@codingame/monaco-vscode-api/vscode/vs/base/common/uri';
import {
    FileChangeType,
    FileSystemProviderCapabilities,
    FileSystemProviderError,
    FileSystemProviderErrorCode,
    FileType,
    type IFileChange,
    type IFileOverwriteOptions,
    type IFileSystemProviderWithFileReadWriteCapability,
    type IFileWriteOptions,
    type IStat,
} from '@codingame/monaco-vscode-files-service-override';

import type { ToolDocumentApi } from './client';
import type { ToolDocument, ToolEvent } from './types';
import { normalizePath, splitPath } from './path';

export const WORKSPACE_SCHEME = 'lernumi';
export const WORKSPACE_ROOT = URI.from({ scheme: WORKSPACE_SCHEME, authority: 'workspace', path: '/' });

type Recorder = (event: ToolEvent) => void;

export class LernumiFileSystemProvider implements IFileSystemProviderWithFileReadWriteCapability {
    readonly capabilities: FileSystemProviderCapabilities;
    readonly onDidChangeCapabilities = Event.None;
    private readonly changeEmitter = new Emitter<readonly IFileChange[]>();
    readonly onDidChangeFile = this.changeEmitter.event;

    private readonly byPath = new Map<string, ToolDocument>();
    private readonly childrenLoaded = new Set<string>();
    private readonly snapshotted = new Set<string>();

    constructor(
        private readonly api: ToolDocumentApi,
        private readonly readOnly: boolean,
        private readonly record: Recorder = () => undefined,
        private readonly rootCreatedAt = Date.now(),
    ) {
        this.capabilities =
            FileSystemProviderCapabilities.FileReadWrite |
            FileSystemProviderCapabilities.PathCaseSensitive |
            (readOnly ? FileSystemProviderCapabilities.Readonly : 0);
    }

    watch(): IDisposable {
        return { dispose() {} };
    }

    async stat(resource: URI): Promise<IStat> {
        const path = normalizePath(resource.path);
        if (path === '/') {
            return { type: FileType.Directory, ctime: this.rootCreatedAt, mtime: this.rootCreatedAt, size: 0 };
        }
        const document = await this.resolve(path);
        return documentStat(document);
    }

    async documentIdForPath(value: string): Promise<string | null> {
        return (await this.tryResolve(normalizePath(value)))?.id ?? null;
    }

    /** Capture a complete baseline before edits begin, including unopened and empty folders. */
    async recordInitialSnapshot(): Promise<void> {
        await this.snapshotChildren(null, '/');
    }

    async readdir(resource: URI): Promise<[string, FileType][]> {
        const path = normalizePath(resource.path);
        const parent = path === '/' ? null : await this.resolve(path);
        if (parent?.entryKind === 'FILE') throw fsError(FileSystemProviderErrorCode.FileNotADirectory, path);

        const children = await this.loadChildren(parent?.id ?? null, path);
        return children.map((document) => [
            document.name,
            document.entryKind === 'FOLDER' ? FileType.Directory : FileType.File,
        ]);
    }

    async readFile(resource: URI): Promise<Uint8Array> {
        const path = normalizePath(resource.path);
        const document = await this.resolve(path);
        if (document.entryKind === 'FOLDER') throw fsError(FileSystemProviderErrorCode.FileIsADirectory, path);

        const result = await this.api.readDocument(document.id);
        if (result.etag) this.byPath.set(path, { ...document, contentHash: result.etag });
        if (!this.snapshotted.has(document.id)) {
            this.snapshotted.add(document.id);
            this.recordSnapshot(document, path, result.bytes);
        }
        return result.bytes;
    }

    async writeFile(resource: URI, content: Uint8Array, options: IFileWriteOptions): Promise<void> {
        this.assertWritable();
        const path = normalizePath(resource.path);
        if (path === '/') throw fsError(FileSystemProviderErrorCode.FileIsADirectory, path);

        let document: ToolDocument | null = null;
        try {
            document = await this.resolve(path);
        } catch (error) {
            if (!isFsError(error, FileSystemProviderErrorCode.FileNotFound)) throw error;
        }

        if (document) {
            if (document.entryKind === 'FOLDER') throw fsError(FileSystemProviderErrorCode.FileIsADirectory, path);
            if (!options.overwrite) throw fsError(FileSystemProviderErrorCode.FileExists, path);
        } else {
            if (!options.create) throw fsError(FileSystemProviderErrorCode.FileNotFound, path);
            const { parentPath, name } = splitPath(path);
            const parent = parentPath === '/' ? null : await this.resolve(parentPath);
            if (parent?.entryKind === 'FILE') throw fsError(FileSystemProviderErrorCode.FileNotADirectory, parentPath);
            document = await this.api.createDocument({
                entryKind: 'FILE',
                name,
                parentFolderId: parent?.id ?? null,
            });
            this.cache(path, document);
            this.record(event('file.created', { documentId: document.id, path }));
            this.fire(FileChangeType.ADDED, resource);
        }

        const etag = document.contentHash;
        if (!etag) throw fsError(FileSystemProviderErrorCode.Unavailable, path);
        const saveRequestId = crypto.randomUUID();
        // Record the causal point before the HTTP write starts. A newer edit may arrive while the
        // save request is in flight, so replay integrity must compare the response checkpoint with
        // the content at this event rather than with whichever edit happens to precede file.saved.
        this.record(event('file.save-requested', {
            documentId: document.id,
            path,
            saveRequestId,
            sizeBytes: content.byteLength,
        }));
        try {
            const updated = await this.api.writeDocument(document.id, content, etag, mimeTypeFor(path));
            this.cache(path, updated);
            this.record(event('file.saved', {
                documentId: updated.id,
                path,
                saveRequestId,
                contentHash: updated.contentHash,
                sizeBytes: updated.sizeBytes,
            }));
            this.fire(FileChangeType.UPDATED, resource);
        } catch (error) {
            if (isApiStatus(error, 412)) {
                throw fsError(FileSystemProviderErrorCode.FileWriteLocked, path);
            }
            throw error;
        }
    }

    async mkdir(resource: URI): Promise<void> {
        this.assertWritable();
        const path = normalizePath(resource.path);
        if (path === '/') return;
        if (await this.tryResolve(path)) throw fsError(FileSystemProviderErrorCode.FileExists, path);
        const { parentPath, name } = splitPath(path);
        const parent = parentPath === '/' ? null : await this.resolve(parentPath);
        if (parent?.entryKind === 'FILE') throw fsError(FileSystemProviderErrorCode.FileNotADirectory, parentPath);

        const created = await this.api.createDocument({
            entryKind: 'FOLDER',
            name,
            parentFolderId: parent?.id ?? null,
        });
        this.cache(path, created);
        this.childrenLoaded.delete(parent?.id ?? 'root');
        this.record(event('folder.created', { documentId: created.id, path }));
        this.fire(FileChangeType.ADDED, resource);
    }

    async delete(resource: URI): Promise<void> {
        this.assertWritable();
        const path = normalizePath(resource.path);
        if (path === '/') throw fsError(FileSystemProviderErrorCode.NoPermissions, path);
        const document = await this.resolve(path);
        await this.api.deleteDocument(document.id);
        this.invalidate();
        this.record(event(document.entryKind === 'FOLDER' ? 'folder.deleted' : 'file.deleted', {
            documentId: document.id,
            path,
        }));
        this.fire(FileChangeType.DELETED, resource);
    }

    async rename(from: URI, to: URI, options: IFileOverwriteOptions): Promise<void> {
        this.assertWritable();
        const fromPath = normalizePath(from.path);
        const toPath = normalizePath(to.path);
        if (fromPath === '/' || toPath === '/') throw fsError(FileSystemProviderErrorCode.NoPermissions, fromPath);
        if (fromPath === toPath) return;

        const source = await this.resolve(fromPath);
        const destination = await this.tryResolve(toPath);
        if (destination) {
            if (!options.overwrite) throw fsError(FileSystemProviderErrorCode.FileExists, toPath);
            await this.api.deleteDocument(destination.id);
        }

        const { parentPath, name } = splitPath(toPath);
        const parent = parentPath === '/' ? null : await this.resolve(parentPath);
        if (parent?.entryKind === 'FILE') throw fsError(FileSystemProviderErrorCode.FileNotADirectory, parentPath);
        const updated = await this.api.updateDocument(source.id, {
            name,
            parentFolderId: parent?.id ?? null,
        });
        this.invalidate();
        this.cache(toPath, updated);
        this.record(event(source.entryKind === 'FOLDER' ? 'folder.renamed' : 'file.renamed', {
            documentId: source.id,
            fromPath,
            toPath,
        }));
        this.changeEmitter.fire([
            { type: FileChangeType.DELETED, resource: from },
            { type: FileChangeType.ADDED, resource: to },
        ]);
    }

    private async resolve(path: string): Promise<ToolDocument> {
        const cached = this.byPath.get(path);
        if (cached) return cached;
        if (path === '/') throw fsError(FileSystemProviderErrorCode.FileNotFound, path);

        let parentId: string | null = null;
        let parentPath = '/';
        for (const name of path.slice(1).split('/')) {
            const children = await this.loadChildren(parentId, parentPath);
            const child = children.find((candidate) => candidate.name === name);
            if (!child) throw fsError(FileSystemProviderErrorCode.FileNotFound, path);
            parentPath = joinPath(parentPath, name);
            parentId = child.id;
        }
        return this.byPath.get(path) ?? Promise.reject(fsError(FileSystemProviderErrorCode.FileNotFound, path));
    }

    private async tryResolve(path: string): Promise<ToolDocument | null> {
        try {
            return await this.resolve(path);
        } catch (error) {
            if (isFsError(error, FileSystemProviderErrorCode.FileNotFound)) return null;
            throw error;
        }
    }

    private async loadChildren(parentFolderId: string | null, parentPath: string): Promise<ToolDocument[]> {
        const key = parentFolderId ?? 'root';
        if (!this.childrenLoaded.has(key)) {
            const children = await this.api.listDocuments(parentFolderId);
            for (const child of children) this.cache(joinPath(parentPath, child.name), child);
            this.childrenLoaded.add(key);
        }
        return [...this.byPath.entries()]
            .filter(([, document]) => document.parentFolderId === parentFolderId)
            .map(([, document]) => document)
            .sort((a, b) => Number(b.entryKind === 'FOLDER') - Number(a.entryKind === 'FOLDER') || a.name.localeCompare(b.name));
    }

    private async snapshotChildren(parentFolderId: string | null, parentPath: string): Promise<void> {
        const children = await this.api.listDocuments(parentFolderId);
        for (const document of children) {
            const path = joinPath(parentPath, document.name);
            this.cache(path, document);
            if (document.entryKind === 'FOLDER') {
                this.record(event('folder.snapshot', { documentId: document.id, path }));
                await this.snapshotChildren(document.id, path);
                continue;
            }

            if (this.snapshotted.has(document.id)) continue;
            this.snapshotted.add(document.id);
            const result = await this.api.readDocument(document.id);
            if (result.etag) this.byPath.set(path, { ...document, contentHash: result.etag });
            this.recordSnapshot(document, path, result.bytes);
        }
        this.childrenLoaded.add(parentFolderId ?? 'root');
    }

    private cache(path: string, document: ToolDocument): void {
        this.byPath.set(normalizePath(path), document);
    }

    private invalidate(): void {
        this.byPath.clear();
        this.childrenLoaded.clear();
    }

    private fire(type: FileChangeType, resource: URI): void {
        this.changeEmitter.fire([{ type, resource }]);
    }

    private assertWritable(): void {
        if (this.readOnly) throw fsError(FileSystemProviderErrorCode.NoPermissions, 'Workspace is read-only');
    }

    private recordSnapshot(document: ToolDocument, path: string, bytes: Uint8Array): void {
        if (!isTextDocument(document, bytes)) {
            this.record(event('file.snapshot', {
                documentId: document.id,
                path,
                encoding: 'binary-omitted',
                sizeBytes: bytes.byteLength,
            }));
            return;
        }

        const content = new TextDecoder().decode(bytes);
        const chunkSize = 64 * 1024;
        const chunks = Math.max(1, Math.ceil(content.length / chunkSize));
        for (let index = 0; index < chunks; index += 1) {
            this.record(event('file.snapshot', {
                documentId: document.id,
                path,
                encoding: 'utf-8',
                chunkIndex: index,
                chunkCount: chunks,
                content: content.slice(index * chunkSize, (index + 1) * chunkSize),
            }));
        }
    }
}

function joinPath(parent: string, name: string): string {
    return normalizePath(`${parent}/${name}`);
}

function documentStat(document: ToolDocument): IStat {
    return {
        type: document.entryKind === 'FOLDER' ? FileType.Directory : FileType.File,
        ctime: Date.parse(document.createdAt),
        mtime: Date.parse(document.updatedAt),
        size: document.sizeBytes ?? 0,
    };
}

function fsError(code: FileSystemProviderErrorCode, path: string): FileSystemProviderError {
    return FileSystemProviderError.create(`${code}: ${path}`, code);
}

function isFsError(error: unknown, code: FileSystemProviderErrorCode): boolean {
    return error instanceof FileSystemProviderError && error.code === code;
}

function isApiStatus(error: unknown, status: number): boolean {
    return typeof error === 'object' && error !== null && 'status' in error && error.status === status;
}

function event(type: string, details: Record<string, unknown>): ToolEvent {
    return { schema: 1, type, at: new Date().toISOString(), ...details };
}

function isTextDocument(document: ToolDocument, bytes: Uint8Array): boolean {
    if (document.mimeType?.startsWith('text/')) return true;
    if (document.mimeType?.includes('json') || document.mimeType?.includes('javascript')) return true;
    return !bytes.slice(0, Math.min(bytes.length, 8_192)).includes(0);
}

function mimeTypeFor(path: string): string {
    const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
    return ({
        '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.jsx': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.ts': 'text/typescript; charset=utf-8',
        '.tsx': 'text/typescript; charset=utf-8',
    } as Record<string, string>)[extension] ?? 'text/plain; charset=utf-8';
}
