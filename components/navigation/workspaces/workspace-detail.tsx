'use client';

import { useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    Add01Icon,
    ArrowRight01Icon,
    Delete02Icon,
    File01Icon,
    Folder01Icon,
    Home01Icon,
    PencilEdit01Icon,
    Upload01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toast } from 'sonner';

import { ResourceActionDialog } from '@/components/admin/resource-action-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
    documentBaseName,
    documentParentPath,
    joinDocumentPath,
    normalizeDocumentPath,
} from '@/lib/workspaces/document-path';

type DocumentItem = {
    id: string;
    displayPath: string;
    entryKind: 'FILE' | 'FOLDER';
    hash: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    updated: string;
    downloadHref: string | null;
};

export function WorkspaceDetail({
    workspaceId,
    initialName,
    personal,
    readOnly,
    documents,
}: {
    workspaceId: string;
    initialName: string;
    personal: boolean;
    readOnly: boolean;
    documents: DocumentItem[];
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const fileRef = useRef<HTMLInputElement>(null);
    const [editingWorkspaceName, setEditingWorkspaceName] = useState(false);
    const [workspaceName, setWorkspaceName] = useState(initialName);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [entryName, setEntryName] = useState('');
    const [pending, setPending] = useState(false);

    const requestedPath = searchParams.get('path') ?? '';
    const normalizedRequestedPath = requestedPath
        ? normalizeDocumentPath(requestedPath)
        : '';
    const currentPath =
        normalizedRequestedPath &&
        documents.some(
            (document) =>
                document.entryKind === 'FOLDER' &&
                document.displayPath === normalizedRequestedPath,
        )
            ? normalizedRequestedPath
            : '';
    const visibleEntries = useMemo(
        () =>
            documents
                .filter((document) => documentParentPath(document.displayPath) === currentPath)
                .sort(
                    (left, right) =>
                        Number(right.entryKind === 'FOLDER') -
                            Number(left.entryKind === 'FOLDER') ||
                        documentBaseName(left.displayPath).localeCompare(
                            documentBaseName(right.displayPath),
                            undefined,
                            { numeric: true, sensitivity: 'base' },
                        ),
                ),
        [currentPath, documents],
    );

    function navigateTo(path: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (path) params.set('path', path);
        else params.delete('path');
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
    }

    async function renameWorkspace() {
        if (!workspaceName.trim() || pending) return;
        setPending(true);
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: workspaceName }),
            });
            const body = (await response.json().catch(() => ({}))) as {
                error?: { message?: string };
            };
            if (!response.ok) throw new Error(body.error?.message ?? 'Could not rename workspace');
            setEditingWorkspaceName(false);
            toast.success('Workspace renamed.');
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not rename workspace');
        } finally {
            setPending(false);
        }
    }

    async function createFolder() {
        const displayPath = joinDocumentPath(currentPath, folderName);
        if (!displayPath || pending) return;
        setPending(true);
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entryKind: 'FOLDER', displayPath }),
            });
            const body = (await response.json().catch(() => ({}))) as {
                error?: { message?: string };
            };
            if (!response.ok) throw new Error(body.error?.message ?? 'Could not create folder');
            setFolderName('');
            setCreatingFolder(false);
            toast.success('Folder created.');
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not create folder');
        } finally {
            setPending(false);
        }
    }

    async function upload(file: File) {
        const displayPath = joinDocumentPath(currentPath, file.name);
        if (!displayPath) return;
        setPending(true);
        try {
            const form = new FormData();
            form.set('file', file);
            form.set('displayPath', displayPath);
            const response = await fetch(`/api/workspaces/${workspaceId}/documents`, {
                method: 'POST',
                body: form,
            });
            const body = (await response.json().catch(() => ({}))) as {
                error?: { message?: string };
            };
            if (!response.ok) throw new Error(body.error?.message ?? 'Could not upload file');
            toast.success(`${file.name} uploaded.`);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not upload file');
        } finally {
            setPending(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    }

    function beginRename(document: DocumentItem) {
        setRenamingId(document.id);
        setEntryName(documentBaseName(document.displayPath));
        setCreatingFolder(false);
    }

    async function renameEntry(document: DocumentItem) {
        const displayPath = joinDocumentPath(
            documentParentPath(document.displayPath),
            entryName,
        );
        if (!displayPath || pending) return;
        setPending(true);
        try {
            const response = await fetch(
                `/api/workspaces/${workspaceId}/documents/${document.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayPath }),
                },
            );
            const body = (await response.json().catch(() => ({}))) as {
                error?: { message?: string };
            };
            if (!response.ok) throw new Error(body.error?.message ?? 'Could not rename item');
            setRenamingId(null);
            setEntryName('');
            toast.success('Item renamed.');
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not rename item');
        } finally {
            setPending(false);
        }
    }

    const breadcrumbs = currentPath ? currentPath.split('/') : [];

    return (
        <div className="space-y-5">
            <section className="border-border border-b pb-5">
                <div className="flex flex-wrap items-center gap-3">
                    {editingWorkspaceName ? (
                        <Input
                            value={workspaceName}
                            onChange={(event) => setWorkspaceName(event.target.value)}
                            className="max-w-xl"
                            maxLength={120}
                            autoFocus
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') void renameWorkspace();
                                if (event.key === 'Escape') {
                                    setWorkspaceName(initialName);
                                    setEditingWorkspaceName(false);
                                }
                            }}
                        />
                    ) : (
                        <h1 className="font-heading min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight">
                            {initialName}
                        </h1>
                    )}
                    {!readOnly &&
                        (editingWorkspaceName ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setWorkspaceName(initialName);
                                        setEditingWorkspaceName(false);
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    disabled={!workspaceName.trim() || pending}
                                    onClick={() => void renameWorkspace()}
                                >
                                    {pending && <Spinner />}
                                    Save name
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={() => setEditingWorkspaceName(true)}>
                                <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                                Rename workspace
                            </Button>
                        ))}
                    {personal && !editingWorkspaceName && (
                        <ResourceActionDialog
                            endpoint={`/api/workspaces/${workspaceId}`}
                            method="DELETE"
                            title={`Delete ${initialName}?`}
                            description="The workspace, every folder and every uploaded file will be permanently deleted."
                            confirmLabel="Delete workspace"
                            destructive
                            onCompleted={() => router.push('/navigation/workspaces')}
                            trigger={
                                <Button variant="outline" className="text-destructive">
                                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                                    Delete
                                </Button>
                            }
                        />
                    )}
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                    {personal
                        ? 'Personal workspace · activity is not recorded.'
                        : readOnly
                          ? 'Submitted assessment workspace · read-only.'
                          : 'Assessment workspace · changes remain available until submission.'}
                </p>
            </section>

            <section className="border-border overflow-hidden rounded-lg border">
                <div className="bg-muted/25 flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
                    <nav aria-label="Folder path" className="flex min-w-0 flex-1 items-center gap-0.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => navigateTo('')}
                            aria-label="Workspace root"
                        >
                            <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />
                            Root
                        </Button>
                        {breadcrumbs.map((segment, index) => {
                            const path = breadcrumbs.slice(0, index + 1).join('/');
                            return (
                                <span key={path} className="flex min-w-0 items-center">
                                    <HugeiconsIcon
                                        icon={ArrowRight01Icon}
                                        strokeWidth={2}
                                        className="text-muted-foreground size-3.5 shrink-0"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 max-w-44 truncate px-2"
                                        onClick={() => navigateTo(path)}
                                    >
                                        {segment}
                                    </Button>
                                </span>
                            );
                        })}
                    </nav>

                    {!readOnly && (
                        <div className="flex items-center gap-2">
                            <input
                                ref={fileRef}
                                type="file"
                                className="hidden"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) void upload(file);
                                }}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pending}
                                onClick={() => {
                                    setCreatingFolder(true);
                                    setRenamingId(null);
                                }}
                            >
                                <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
                                New folder
                            </Button>
                            <Button
                                size="sm"
                                disabled={pending}
                                onClick={() => fileRef.current?.click()}
                            >
                                {pending ? (
                                    <Spinner />
                                ) : (
                                    <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
                                )}
                                Upload file
                            </Button>
                        </div>
                    )}
                </div>

                <div className="text-muted-foreground hidden grid-cols-[minmax(16rem,1fr)_11rem_8rem_11rem_6rem] border-b px-4 py-2 text-xs font-medium md:grid">
                    <span>Name</span>
                    <span>Type</span>
                    <span>Size</span>
                    <span>Modified</span>
                    <span className="text-right">Actions</span>
                </div>

                {creatingFolder && (
                    <div className="bg-primary/[0.035] grid items-center gap-3 border-b px-4 py-3 md:grid-cols-[minmax(16rem,1fr)_11rem_8rem_11rem_6rem]">
                        <div className="flex min-w-0 items-center gap-3">
                            <HugeiconsIcon
                                icon={Folder01Icon}
                                strokeWidth={2}
                                className="text-primary size-5 shrink-0"
                            />
                            <Input
                                value={folderName}
                                onChange={(event) => setFolderName(event.target.value)}
                                placeholder="Folder name"
                                className="h-8"
                                autoFocus
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') void createFolder();
                                    if (event.key === 'Escape') {
                                        setCreatingFolder(false);
                                        setFolderName('');
                                    }
                                }}
                            />
                        </div>
                        <span className="text-muted-foreground text-sm">Folder</span>
                        <span className="text-muted-foreground text-sm">—</span>
                        <span className="text-muted-foreground text-sm">New</span>
                        <div className="flex justify-end gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setCreatingFolder(false);
                                    setFolderName('');
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={!folderName.trim() || pending}
                                onClick={() => void createFolder()}
                                aria-label="Create folder"
                            >
                                {pending ? <Spinner /> : <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />}
                            </Button>
                        </div>
                    </div>
                )}

                {visibleEntries.length === 0 && !creatingFolder ? (
                    <div className="px-6 py-16 text-center">
                        <HugeiconsIcon
                            icon={Folder01Icon}
                            strokeWidth={1.5}
                            className="text-muted-foreground/55 mx-auto size-8"
                        />
                        <p className="mt-3 text-sm font-medium">This folder is empty</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {readOnly
                                ? 'No files or folders were saved here.'
                                : 'Create a folder or upload a file to get started.'}
                        </p>
                    </div>
                ) : (
                    visibleEntries.map((document) => (
                        <ExplorerRow
                            key={document.id}
                            workspaceId={workspaceId}
                            document={document}
                            readOnly={readOnly}
                            renaming={renamingId === document.id}
                            entryName={entryName}
                            pending={pending}
                            onEntryNameChange={setEntryName}
                            onOpenFolder={() => navigateTo(document.displayPath)}
                            onBeginRename={() => beginRename(document)}
                            onCancelRename={() => {
                                setRenamingId(null);
                                setEntryName('');
                            }}
                            onRename={() => void renameEntry(document)}
                        />
                    ))
                )}

                <footer className="bg-muted/20 text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-xs">
                    <span>
                        {visibleEntries.length} {visibleEntries.length === 1 ? 'item' : 'items'}
                    </span>
                    <span className="truncate pl-4 font-mono">/{currentPath}</span>
                </footer>
            </section>
        </div>
    );
}

function ExplorerRow({
    workspaceId,
    document,
    readOnly,
    renaming,
    entryName,
    pending,
    onEntryNameChange,
    onOpenFolder,
    onBeginRename,
    onCancelRename,
    onRename,
}: {
    workspaceId: string;
    document: DocumentItem;
    readOnly: boolean;
    renaming: boolean;
    entryName: string;
    pending: boolean;
    onEntryNameChange: (value: string) => void;
    onOpenFolder: () => void;
    onBeginRename: () => void;
    onCancelRename: () => void;
    onRename: () => void;
}) {
    const name = documentBaseName(document.displayPath);
    const folder = document.entryKind === 'FOLDER';

    return (
        <div className="hover:bg-muted/20 grid items-center gap-3 border-b px-4 py-3 last:border-b-0 md:grid-cols-[minmax(16rem,1fr)_11rem_8rem_11rem_6rem]">
            <div className="flex min-w-0 items-center gap-3">
                <HugeiconsIcon
                    icon={folder ? Folder01Icon : File01Icon}
                    strokeWidth={folder ? 1.8 : 2}
                    className={folder ? 'text-primary size-5 shrink-0' : 'text-muted-foreground size-5 shrink-0'}
                />
                {renaming ? (
                    <Input
                        value={entryName}
                        onChange={(event) => onEntryNameChange(event.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') onRename();
                            if (event.key === 'Escape') onCancelRename();
                        }}
                    />
                ) : folder ? (
                    <button
                        type="button"
                        onClick={onOpenFolder}
                        className="hover:text-primary min-w-0 truncate text-left text-sm font-medium transition-colors"
                    >
                        {name}
                    </button>
                ) : (
                    <span className="min-w-0 truncate text-sm font-medium">{name}</span>
                )}
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <span className="md:hidden">Type:</span>
                {folder ? 'File folder' : fileTypeLabel(document)}
            </div>
            <div className="text-muted-foreground text-sm tabular-nums">
                <span className="md:hidden">Size: </span>
                {folder ? '—' : formatBytes(document.sizeBytes)}
            </div>
            <div className="text-muted-foreground text-sm">
                <span className="md:hidden">Modified: </span>
                {document.updated}
            </div>
            <div className="flex justify-end gap-1">
                {renaming ? (
                    <>
                        <Button variant="ghost" size="icon-sm" onClick={onCancelRename} aria-label="Cancel rename">
                            <span aria-hidden>×</span>
                        </Button>
                        <Button size="icon-sm" disabled={!entryName.trim() || pending} onClick={onRename} aria-label="Save name">
                            {pending ? <Spinner /> : <span aria-hidden>✓</span>}
                        </Button>
                    </>
                ) : !readOnly ? (
                    <>
                        <Button variant="ghost" size="icon-sm" onClick={onBeginRename} aria-label={`Rename ${name}`}>
                            <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                        </Button>
                        <ResourceActionDialog
                            endpoint={`/api/workspaces/${workspaceId}/documents/${document.id}`}
                            method="DELETE"
                            title={`Delete ${name}?`}
                            description={
                                folder
                                    ? 'This folder and every file or folder inside it will be permanently deleted.'
                                    : 'This file and its stored content will be permanently deleted.'
                            }
                            confirmLabel={folder ? 'Delete folder' : 'Delete file'}
                            destructive
                            trigger={
                                <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Delete ${name}`}>
                                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                                </Button>
                            }
                        />
                    </>
                ) : (
                    <Badge variant="secondary">Read only</Badge>
                )}
            </div>
        </div>
    );
}

function fileTypeLabel(document: DocumentItem): string {
    if (document.mimeType && document.mimeType !== 'application/octet-stream') {
        const [, subtype] = document.mimeType.split('/');
        if (subtype) return subtype.toUpperCase().replace('X-', '');
    }
    const extension = documentBaseName(document.displayPath).split('.').at(-1);
    return extension && extension !== documentBaseName(document.displayPath)
        ? `${extension.toUpperCase()} file`
        : 'File';
}

function formatBytes(bytes: number | null): string {
    if (bytes === null) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
