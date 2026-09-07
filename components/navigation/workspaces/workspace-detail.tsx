'use client';

import { useMemo, useRef, useState, type InputHTMLAttributes } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    Add01Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Delete02Icon,
    Download01Icon,
    File01Icon,
    Folder01Icon,
    FolderAddIcon,
    FolderUploadIcon,
    Home01Icon,
    MoreVerticalIcon,
    PencilEdit01Icon,
    Upload01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toast } from 'sonner';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useWorkspaceFolderHistory } from '@/components/navigation/workspaces/use-workspace-folder-history';
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
    readOnly,
    documents,
}: {
    workspaceId: string;
    readOnly: boolean;
    documents: DocumentItem[];
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const fileRef = useRef<HTMLInputElement>(null);
    const folderRef = useRef<HTMLInputElement>(null);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [entryName, setEntryName] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
    const [pending, setPending] = useState(false);
    const [pendingLabel, setPendingLabel] = useState<string | null>(null);

    const requestedPath = searchParams.get('path') ?? '';
    const normalizedRequestedPath = requestedPath ? normalizeDocumentPath(requestedPath) : '';
    const currentPath = normalizedRequestedPath && documents.some(
        (document) => document.entryKind === 'FOLDER' && document.displayPath === normalizedRequestedPath,
    ) ? normalizedRequestedPath : '';
    const visibleEntries = useMemo(
        () => documents
            .filter((document) => documentParentPath(document.displayPath) === currentPath)
            .sort((left, right) =>
                Number(right.entryKind === 'FOLDER') - Number(left.entryKind === 'FOLDER') ||
                documentBaseName(left.displayPath).localeCompare(
                    documentBaseName(right.displayPath),
                    undefined,
                    { numeric: true, sensitivity: 'base' },
                )),
        [currentPath, documents],
    );
    const validFolderPaths = useMemo(
        () => new Set([
            '',
            ...documents
                .filter((document) => document.entryKind === 'FOLDER')
                .map((document) => document.displayPath),
        ]),
        [documents],
    );
    const folderHistory = useWorkspaceFolderHistory({
        workspaceId,
        currentPath,
        validPaths: validFolderPaths,
    });
    const selectedItem = visibleEntries.find((document) => document.id === selectedId) ?? null;

    function navigateTo(path: string) {
        setSelectedId(null);
        setRenamingId(null);
        setCreatingFolder(false);
        const params = new URLSearchParams(searchParams.toString());
        if (path) params.set('path', path);
        else params.delete('path');
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
    }

    function navigateHistory(direction: -1 | 1) {
        const path = direction === -1 ? folderHistory.goBack() : folderHistory.goForward();
        if (path !== null) navigateTo(path);
    }

    function startCreatingFolder() {
        if (readOnly || pending) return;
        setCreatingFolder(true);
        setFolderName('');
        setRenamingId(null);
        setSelectedId(null);
    }

    async function createFolderAtPath(displayPath: string, allowExisting = false) {
        const response = await fetch(`/api/workspaces/${workspaceId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryKind: 'FOLDER', displayPath }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        if (!response.ok && !(allowExisting && response.status === 409)) {
            throw new Error(body.error?.message ?? 'Could not create folder');
        }
    }

    async function createFolder() {
        const displayPath = joinDocumentPath(currentPath, folderName);
        if (!displayPath || pending) return;
        setPending(true);
        setPendingLabel('Creating folder');
        try {
            await createFolderAtPath(displayPath);
            setFolderName('');
            setCreatingFolder(false);
            toast.success('Folder created.');
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not create folder');
        } finally {
            setPending(false);
            setPendingLabel(null);
        }
    }

    async function uploadFile(file: File, displayPath: string) {
        const form = new FormData();
        form.set('file', file);
        form.set('displayPath', displayPath);
        const response = await fetch(`/api/workspaces/${workspaceId}/documents`, { method: 'POST', body: form });
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? `Could not upload ${file.name}`);
    }

    async function uploadFiles(files: File[], preserveFolders: boolean) {
        if (files.length === 0 || pending) return;
        setPending(true);
        try {
            if (preserveFolders) {
                const folderPaths = new Set<string>();
                for (const file of files) {
                    const relativePath = normalizeDocumentPath(file.webkitRelativePath || file.name);
                    if (!relativePath) throw new Error(`Invalid path for ${file.name}`);
                    const segments = relativePath.split('/').slice(0, -1);
                    for (let length = 1; length <= segments.length; length += 1) {
                        const folderPath = joinDocumentPath(currentPath, segments.slice(0, length).join('/'));
                        if (!folderPath) throw new Error(`Invalid folder path for ${file.name}`);
                        folderPaths.add(folderPath);
                    }
                }
                const orderedFolders = [...folderPaths].sort(
                    (left, right) => left.split('/').length - right.split('/').length,
                );
                for (let index = 0; index < orderedFolders.length; index += 1) {
                    setPendingLabel(`Creating folders ${index + 1}/${orderedFolders.length}`);
                    await createFolderAtPath(orderedFolders[index], true);
                }
            }

            for (let index = 0; index < files.length; index += 1) {
                const file = files[index];
                const relativePath = preserveFolders
                    ? normalizeDocumentPath(file.webkitRelativePath || file.name)
                    : file.name;
                const displayPath = relativePath && joinDocumentPath(currentPath, relativePath);
                if (!displayPath) throw new Error(`Invalid path for ${file.name}`);
                setPendingLabel(`Uploading ${index + 1}/${files.length}`);
                await uploadFile(file, displayPath);
            }
            toast.success(preserveFolders
                ? `Folder uploaded with ${files.length} ${files.length === 1 ? 'file' : 'files'}.`
                : `${files.length} ${files.length === 1 ? 'file' : 'files'} uploaded.`);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Upload failed');
            router.refresh();
        } finally {
            setPending(false);
            setPendingLabel(null);
            if (fileRef.current) fileRef.current.value = '';
            if (folderRef.current) folderRef.current.value = '';
        }
    }

    function beginRename(document: DocumentItem) {
        setSelectedId(document.id);
        setRenamingId(document.id);
        setEntryName(documentBaseName(document.displayPath));
        setCreatingFolder(false);
    }

    async function renameEntry(document: DocumentItem) {
        const displayPath = joinDocumentPath(documentParentPath(document.displayPath), entryName);
        if (!displayPath || pending) return;
        setPending(true);
        setPendingLabel('Renaming');
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}/documents/${document.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayPath }),
            });
            const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
            if (!response.ok) throw new Error(body.error?.message ?? 'Could not rename item');
            setRenamingId(null);
            setEntryName('');
            toast.success('Item renamed.');
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not rename item');
        } finally {
            setPending(false);
            setPendingLabel(null);
        }
    }

    async function deleteEntry() {
        if (!deleteTarget || pending) return;
        setPending(true);
        setPendingLabel('Deleting');
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}/documents/${deleteTarget.id}`, { method: 'DELETE' });
            const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
            if (!response.ok) throw new Error(body.error?.message ?? 'Could not delete item');
            toast.success(`${documentBaseName(deleteTarget.displayPath)} deleted.`);
            setDeleteTarget(null);
            setSelectedId(null);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not delete item');
        } finally {
            setPending(false);
            setPendingLabel(null);
        }
    }

    const breadcrumbs = currentPath ? currentPath.split('/') : [];

    return (
        <div className="bg-background flex h-full min-h-0 flex-col overflow-hidden">
            <section className="flex min-h-0 flex-1 flex-col">
                <div className="bg-muted/20 flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
                    <nav aria-label="Folder path" className="flex min-w-0 flex-1 items-center gap-0.5">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={!folderHistory.canGoBack}
                            onClick={() => navigateHistory(-1)}
                            aria-label="Previous folder"
                            title="Previous folder"
                        >
                            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={!folderHistory.canGoForward}
                            onClick={() => navigateHistory(1)}
                            aria-label="Next folder"
                            title="Next folder"
                        >
                            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                        </Button>
                        <span aria-hidden className="bg-border mx-1 h-5 w-px shrink-0" />
                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigateTo('')} aria-label="Workspace root">
                            <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />Root
                        </Button>
                        {breadcrumbs.map((segment, index) => {
                            const path = breadcrumbs.slice(0, index + 1).join('/');
                            return <span key={path} className="flex min-w-0 items-center">
                                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground size-3.5 shrink-0" />
                                <Button variant="ghost" size="sm" className="h-8 max-w-44 truncate px-2" onClick={() => navigateTo(path)}>{segment}</Button>
                            </span>;
                        })}
                    </nav>

                    <div className="flex items-center gap-1.5">
                        {pendingLabel && <span className="text-muted-foreground hidden items-center gap-1.5 pr-1 text-xs sm:flex"><Spinner />{pendingLabel}</span>}
                        {!readOnly && <>
                        <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => void uploadFiles([...(event.target.files ?? [])], false)} />
                        <input
                            ref={folderRef}
                            type="file"
                            multiple
                            className="hidden"
                            {...({ webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement>)}
                            onChange={(event) => void uploadFiles([...(event.target.files ?? [])], true)}
                        />
                        <Button variant="outline" size="sm" disabled={pending} onClick={startCreatingFolder}><HugeiconsIcon icon={FolderAddIcon} strokeWidth={2} /><span className="hidden sm:inline">New folder</span></Button>
                        <Button variant="outline" size="sm" disabled={pending} onClick={() => folderRef.current?.click()}><HugeiconsIcon icon={FolderUploadIcon} strokeWidth={2} /><span className="hidden sm:inline">Upload folder</span></Button>
                            <Button size="sm" disabled={pending} onClick={() => fileRef.current?.click()}><HugeiconsIcon icon={Upload01Icon} strokeWidth={2} /><span className="hidden sm:inline">Upload files</span></Button>
                        </>}
                    </div>
                </div>

                <div className="text-muted-foreground hidden shrink-0 grid-cols-[minmax(16rem,1fr)_11rem_8rem_11rem_6rem] border-b px-4 py-2 text-xs font-medium md:grid">
                    <span>Name</span><span>Type</span><span>Size</span><span>Modified</span><span className="text-right">Actions</span>
                </div>

                <ContextMenu>
                    <ContextMenuTrigger
                        className="min-h-0 flex-1 overflow-y-auto outline-none"
                        onContextMenu={(event) => { if (!(event.target as HTMLElement).closest('[data-entry-row]')) setSelectedId(null); }}
                        onClick={(event) => { if (!(event.target as HTMLElement).closest('[data-entry-row]')) setSelectedId(null); }}
                    >
                        {creatingFolder && <div className="bg-primary/[0.035] grid items-center gap-3 border-b px-4 py-3 md:grid-cols-[minmax(16rem,1fr)_11rem_8rem_11rem_6rem]">
                            <div className="flex min-w-0 items-center gap-3">
                                <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} className="text-primary size-5 shrink-0" />
                                <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Folder name" className="h-8" autoFocus onKeyDown={(event) => {
                                    if (event.key === 'Enter') void createFolder();
                                    if (event.key === 'Escape') { setCreatingFolder(false); setFolderName(''); }
                                }} />
                            </div>
                            <span className="text-muted-foreground text-sm">File folder</span><span className="text-muted-foreground text-sm">—</span><span className="text-muted-foreground text-sm">New</span>
                            <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setCreatingFolder(false)}>Cancel</Button>
                                <Button size="icon-sm" disabled={!folderName.trim() || pending} onClick={() => void createFolder()} aria-label="Create folder">{pending ? <Spinner /> : <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />}</Button>
                            </div>
                        </div>}

                        {visibleEntries.length === 0 && !creatingFolder ? (
                            <div className="flex min-h-full items-center justify-center px-6 py-16 text-center"><div>
                                <HugeiconsIcon icon={Folder01Icon} strokeWidth={1.5} className="text-muted-foreground/55 mx-auto size-8" />
                                <p className="mt-3 text-sm font-medium">This folder is empty</p>
                                <p className="text-muted-foreground mt-1 text-sm">{readOnly ? 'No files or folders were saved here.' : 'Right-click here, create a folder or upload files.'}</p>
                            </div></div>
                        ) : visibleEntries.map((document) => (
                            <ExplorerRow
                                key={document.id}
                                document={document}
                                readOnly={readOnly}
                                selected={selectedId === document.id}
                                renaming={renamingId === document.id}
                                entryName={entryName}
                                pending={pending}
                                onSelect={() => setSelectedId(document.id)}
                                onEntryNameChange={setEntryName}
                                onOpenFolder={() => navigateTo(document.displayPath)}
                                onBeginRename={() => beginRename(document)}
                                onCancelRename={() => { setRenamingId(null); setEntryName(''); }}
                                onRename={() => void renameEntry(document)}
                                onDelete={() => setDeleteTarget(document)}
                            />
                        ))}
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-60 rounded-lg">
                        <ContextMenuGroup>
                            <ContextMenuLabel className="py-1.5">{selectedItem ? documentBaseName(selectedItem.displayPath) : `/${currentPath}`}</ContextMenuLabel>
                            {selectedItem?.entryKind === 'FOLDER' && <ContextMenuItem onClick={() => navigateTo(selectedItem.displayPath)}><HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />Open</ContextMenuItem>}
                            {selectedItem?.entryKind === 'FILE' && selectedItem.downloadHref && <ContextMenuItem render={<a href={selectedItem.downloadHref} download />}><HugeiconsIcon icon={Download01Icon} strokeWidth={2} />Download</ContextMenuItem>}
                            {selectedItem && <ContextMenuSeparator />}
                            <ContextMenuItem disabled={readOnly || pending} onClick={startCreatingFolder}><HugeiconsIcon icon={FolderAddIcon} strokeWidth={2} />New folder</ContextMenuItem>
                            <ContextMenuItem disabled={readOnly || pending} onClick={() => fileRef.current?.click()}><HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />Upload files</ContextMenuItem>
                            <ContextMenuItem disabled={readOnly || pending} onClick={() => folderRef.current?.click()}><HugeiconsIcon icon={FolderUploadIcon} strokeWidth={2} />Upload folder</ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem disabled={!selectedItem || readOnly || pending} onClick={() => selectedItem && beginRename(selectedItem)}><HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />Rename selected</ContextMenuItem>
                            <ContextMenuItem variant="destructive" disabled={!selectedItem || readOnly || pending} onClick={() => selectedItem && setDeleteTarget(selectedItem)}><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />Delete selected</ContextMenuItem>
                        </ContextMenuGroup>
                    </ContextMenuContent>
                </ContextMenu>

                <footer className="bg-muted/20 text-muted-foreground flex shrink-0 items-center justify-between border-t px-4 py-2 text-xs">
                    <span>{visibleEntries.length} {visibleEntries.length === 1 ? 'item' : 'items'}</span><span className="truncate pl-4 font-mono">/{currentPath}</span>
                </footer>
            </section>

            <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && !pending && setDeleteTarget(null)}>
                <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {deleteTarget ? documentBaseName(deleteTarget.displayPath) : 'item'}?</AlertDialogTitle>
                        <AlertDialogDescription>{deleteTarget?.entryKind === 'FOLDER' ? 'This folder and every file or folder inside it will be permanently deleted.' : 'This file and its stored content will be permanently deleted.'}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void deleteEntry()}>{pending && <Spinner />}Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function ExplorerRow({
    document, readOnly, selected, renaming, entryName, pending, onSelect,
    onEntryNameChange, onOpenFolder, onBeginRename, onCancelRename, onRename, onDelete,
}: {
    document: DocumentItem;
    readOnly: boolean;
    selected: boolean;
    renaming: boolean;
    entryName: string;
    pending: boolean;
    onSelect: () => void;
    onEntryNameChange: (value: string) => void;
    onOpenFolder: () => void;
    onBeginRename: () => void;
    onCancelRename: () => void;
    onRename: () => void;
    onDelete: () => void;
}) {
    const name = documentBaseName(document.displayPath);
    const folder = document.entryKind === 'FOLDER';
    return <div
        data-entry-row
        role="row"
        tabIndex={0}
        aria-selected={selected}
        className="hover:bg-muted/35 focus-visible:ring-primary/40 aria-selected:bg-primary/[0.08] grid cursor-default items-center gap-3 border-b px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset md:grid-cols-[minmax(16rem,1fr)_11rem_8rem_11rem_6rem]"
        onClick={onSelect}
        onContextMenu={onSelect}
        onDoubleClick={() => folder && onOpenFolder()}
        onKeyDown={(event) => { if (event.key === 'Enter' && folder && !renaming) onOpenFolder(); }}
    >
        <div className="flex min-w-0 items-center gap-3">
            <HugeiconsIcon icon={folder ? Folder01Icon : File01Icon} strokeWidth={folder ? 1.8 : 2} className={folder ? 'text-primary size-5 shrink-0' : 'text-muted-foreground size-5 shrink-0'} />
            {renaming ? <Input
                value={entryName}
                onChange={(event) => onEntryNameChange(event.target.value)}
                className="h-8"
                autoFocus
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') onRename(); if (event.key === 'Escape') onCancelRename(); }}
            /> : <span className="min-w-0 truncate text-sm font-medium">{name}</span>}
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm"><span className="md:hidden">Type:</span>{folder ? 'File folder' : fileTypeLabel(document)}</div>
        <div className="text-muted-foreground text-sm tabular-nums"><span className="md:hidden">Size: </span>{folder ? '—' : formatBytes(document.sizeBytes)}</div>
        <div className="text-muted-foreground text-sm"><span className="md:hidden">Modified: </span>{document.updated}</div>
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            {renaming ? <>
                <Button variant="ghost" size="icon-sm" onClick={onCancelRename} aria-label="Cancel rename"><span aria-hidden>×</span></Button>
                <Button size="icon-sm" disabled={!entryName.trim() || pending} onClick={onRename} aria-label="Save name">{pending ? <Spinner /> : <span aria-hidden>✓</span>}</Button>
            </> : <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button variant="ghost" size="icon-sm" aria-label={`Open actions for ${name}`}>
                            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
                        </Button>
                    }
                />
                <DropdownMenuContent align="end" className="min-w-44 rounded-lg">
                    {folder ? (
                        <DropdownMenuItem onClick={onOpenFolder}>
                            <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
                            Open
                        </DropdownMenuItem>
                    ) : document.downloadHref ? (
                        <DropdownMenuItem render={<a href={document.downloadHref} download />}>
                            <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
                            Download
                        </DropdownMenuItem>
                    ) : null}
                    {!readOnly && <>
                        {(folder || document.downloadHref) && <DropdownMenuSeparator />}
                        <DropdownMenuItem onClick={onBeginRename}>
                            <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                            Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={onDelete}>
                            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                            Delete
                        </DropdownMenuItem>
                    </>}
                </DropdownMenuContent>
            </DropdownMenu>}
        </div>
    </div>;
}

function fileTypeLabel(document: DocumentItem): string {
    if (document.mimeType && document.mimeType !== 'application/octet-stream') {
        const [, subtype] = document.mimeType.split('/');
        if (subtype) return subtype.toUpperCase().replace('X-', '');
    }
    const extension = documentBaseName(document.displayPath).split('.').at(-1);
    return extension && extension !== documentBaseName(document.displayPath) ? `${extension.toUpperCase()} file` : 'File';
}

function formatBytes(bytes: number | null): string {
    if (bytes === null) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
