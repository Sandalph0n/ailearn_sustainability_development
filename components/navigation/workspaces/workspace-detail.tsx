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
    normalizeDocumentName,
    normalizeDocumentPath,
} from '@/lib/workspaces/document-path';

type DocumentItem = {
    id: string;
    name: string;
    parentFolderId: string | null;
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
    currentFolderId,
    folderIds,
    breadcrumbs,
    documents,
}: {
    workspaceId: string;
    readOnly: boolean;
    currentFolderId: string | null;
    folderIds: string[];
    breadcrumbs: Array<{ id: string; name: string }>;
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

    const visibleEntries = useMemo(
        () => [...documents].sort((left, right) =>
                Number(right.entryKind === 'FOLDER') - Number(left.entryKind === 'FOLDER') ||
                left.name.localeCompare(
                    right.name,
                    undefined,
                    { numeric: true, sensitivity: 'base' },
                )),
        [documents],
    );
    const validFolderIds = useMemo(
        () => new Set(['', ...folderIds]),
        [folderIds],
    );
    const folderHistory = useWorkspaceFolderHistory({
        workspaceId,
        currentFolderId: currentFolderId ?? '',
        validFolderIds,
    });
    const selectedItem = visibleEntries.find((document) => document.id === selectedId) ?? null;

    function navigateTo(folderId: string | null) {
        setSelectedId(null);
        setRenamingId(null);
        setCreatingFolder(false);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('path');
        if (folderId) params.set('folder', folderId);
        else params.delete('folder');
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
    }

    function navigateHistory(direction: -1 | 1) {
        const folderId = direction === -1 ? folderHistory.goBack() : folderHistory.goForward();
        if (folderId !== null) navigateTo(folderId || null);
    }

    function startCreatingFolder() {
        if (readOnly || pending) return;
        setCreatingFolder(true);
        setFolderName('');
        setRenamingId(null);
        setSelectedId(null);
    }

    async function createFolderEntry(
        name: string,
        parentFolderId: string | null,
        reuseExisting = false,
    ): Promise<{ id: string; name: string; parentFolderId: string | null }> {
        const response = await fetch(`/api/workspaces/${workspaceId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryKind: 'FOLDER', name, parentFolderId, reuseExisting }),
        });
        const body = (await response.json().catch(() => ({}))) as {
            document?: { id: string; name: string; parentFolderId: string | null };
            error?: { message?: string };
        };
        if (!response.ok || !body.document) {
            throw new Error(body.error?.message ?? 'Could not create folder');
        }
        return body.document;
    }

    async function createFolder() {
        const name = normalizeDocumentName(folderName);
        if (!name || pending) return;
        setPending(true);
        setPendingLabel('Creating folder');
        try {
            await createFolderEntry(name, currentFolderId);
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

    async function uploadFile(file: File, name: string, parentFolderId: string | null) {
        const form = new FormData();
        form.set('file', file);
        form.set('name', name);
        if (parentFolderId) form.set('parentFolderId', parentFolderId);
        const response = await fetch(`/api/workspaces/${workspaceId}/documents`, { method: 'POST', body: form });
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? `Could not upload ${file.name}`);
    }

    async function uploadFiles(files: File[], preserveFolders: boolean) {
        if (files.length === 0 || pending) return;
        setPending(true);
        try {
            const folderByParentAndName = new Map(
                documents
                    .filter((document) => document.entryKind === 'FOLDER')
                    .map((document) => [
                        `${document.parentFolderId ?? ''}\u0000${document.name}`,
                        document.id,
                    ]),
            );

            if (preserveFolders) {
                setPendingLabel('Preparing folders');
            }

            for (let index = 0; index < files.length; index += 1) {
                const file = files[index];
                const relativePath = preserveFolders
                    ? normalizeDocumentPath(file.webkitRelativePath || file.name)
                    : file.name;
                if (!relativePath) throw new Error(`Invalid path for ${file.name}`);
                const segments = relativePath.split('/');
                const name = normalizeDocumentName(segments.pop() ?? '');
                if (!name) throw new Error(`Invalid name for ${file.name}`);

                let parentFolderId = currentFolderId;
                for (const rawFolderName of segments) {
                    const folderName = normalizeDocumentName(rawFolderName);
                    if (!folderName) throw new Error(`Invalid folder name for ${file.name}`);
                    const key = `${parentFolderId ?? ''}\u0000${folderName}`;
                    let folderId = folderByParentAndName.get(key);
                    if (!folderId) {
                        const folder = await createFolderEntry(folderName, parentFolderId, true);
                        folderId = folder.id;
                        folderByParentAndName.set(key, folderId);
                    }
                    parentFolderId = folderId;
                }

                setPendingLabel(`Uploading ${index + 1}/${files.length}`);
                await uploadFile(file, name, parentFolderId);
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
        setEntryName(document.name);
        setCreatingFolder(false);
    }

    async function renameEntry(document: DocumentItem) {
        const name = normalizeDocumentName(entryName);
        if (!name || pending) return;
        setPending(true);
        setPendingLabel('Renaming');
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}/documents/${document.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
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
            toast.success(`${deleteTarget.name} deleted.`);
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

    const currentPathLabel = breadcrumbs.map((breadcrumb) => breadcrumb.name).join('/');

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
                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigateTo(null)} aria-label="Workspace root">
                            <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />Root
                        </Button>
                        {breadcrumbs.map((breadcrumb) => {
                            return <span key={breadcrumb.id} className="flex min-w-0 items-center">
                                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground size-3.5 shrink-0" />
                                <Button variant="ghost" size="sm" className="h-8 max-w-44 truncate px-2" onClick={() => navigateTo(breadcrumb.id)}>{breadcrumb.name}</Button>
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
                                onOpenFolder={() => navigateTo(document.id)}
                                onBeginRename={() => beginRename(document)}
                                onCancelRename={() => { setRenamingId(null); setEntryName(''); }}
                                onRename={() => void renameEntry(document)}
                                onDelete={() => setDeleteTarget(document)}
                            />
                        ))}
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-60 rounded-lg">
                        <ContextMenuGroup>
                            <ContextMenuLabel className="py-1.5">{selectedItem ? selectedItem.name : `/${currentPathLabel}`}</ContextMenuLabel>
                            {selectedItem?.entryKind === 'FOLDER' && <ContextMenuItem onClick={() => navigateTo(selectedItem.id)}><HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />Open</ContextMenuItem>}
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
                    <span>{visibleEntries.length} {visibleEntries.length === 1 ? 'item' : 'items'}</span><span className="truncate pl-4 font-mono">/{currentPathLabel}</span>
                </footer>
            </section>

            <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && !pending && setDeleteTarget(null)}>
                <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {deleteTarget?.name ?? 'item'}?</AlertDialogTitle>
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
    const name = document.name;
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
    const extension = document.name.split('.').at(-1);
    return extension && extension !== document.name ? `${extension.toUpperCase()} file` : 'File';
}

function formatBytes(bytes: number | null): string {
    if (bytes === null) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
