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
    updateExplorerSelection,
    type ExplorerSelectionModifiers,
} from '@/lib/workspaces/explorer-selection';
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
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
    const [deleteTargets, setDeleteTargets] = useState<DocumentItem[] | null>(null);
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
    const orderedIds = useMemo(
        () => visibleEntries.map((document) => document.id),
        [visibleEntries],
    );
    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const selectedItems = useMemo(
        () => visibleEntries.filter((document) => selectedIdSet.has(document.id)),
        [selectedIdSet, visibleEntries],
    );
    const selectedItem = selectedItems.length === 1 ? selectedItems[0] : null;
    const selectedFiles = selectedItems.filter(
        (document) => document.entryKind === 'FILE' && document.downloadHref,
    );

    function clearSelection() {
        setSelectedIds([]);
        setSelectionAnchorId(null);
    }

    function selectEntry(documentId: string, modifiers: ExplorerSelectionModifiers) {
        const next = updateExplorerSelection(
            { selectedIds, anchorId: selectionAnchorId },
            orderedIds,
            documentId,
            modifiers,
        );
        setSelectedIds(next.selectedIds);
        setSelectionAnchorId(next.anchorId);
    }

    function selectForActions(document: DocumentItem) {
        if (selectedIdSet.has(document.id)) return;
        setSelectedIds([document.id]);
        setSelectionAnchorId(document.id);
    }

    function actionTargets(document: DocumentItem): DocumentItem[] {
        return selectedIdSet.has(document.id) ? selectedItems : [document];
    }

    function navigateTo(folderId: string | null) {
        clearSelection();
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
        clearSelection();
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
        setSelectedIds([document.id]);
        setSelectionAnchorId(document.id);
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

    function requestDelete(targets: DocumentItem[]) {
        if (targets.length === 0 || readOnly || pending) return;
        setDeleteTargets(targets);
    }

    async function deleteEntries() {
        if (!deleteTargets || deleteTargets.length === 0 || pending) return;
        const targets = deleteTargets;
        setPending(true);
        setPendingLabel(targets.length === 1 ? 'Deleting item' : `Deleting ${targets.length} items`);
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}/documents`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentIds: targets.map((target) => target.id) }),
            });
            const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
            if (!response.ok) throw new Error(body.error?.message ?? 'Could not delete selected items');
            toast.success(targets.length === 1
                ? `${targets[0].name} deleted.`
                : `${targets.length} items deleted.`);
            setDeleteTargets(null);
            clearSelection();
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not delete selected items');
        } finally {
            setPending(false);
            setPendingLabel(null);
        }
    }

    function downloadEntries(targets: DocumentItem[]) {
        const files = targets.filter(
            (document) => document.entryKind === 'FILE' && document.downloadHref,
        );
        for (const file of files) {
            const link = window.document.createElement('a');
            link.href = file.downloadHref!;
            link.download = file.name;
            link.hidden = true;
            window.document.body.append(link);
            link.click();
            link.remove();
        }
        if (files.length > 1) toast.success(`${files.length} downloads started.`);
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
                        </>}
                        {selectedItems.length > 0 ? <>
                            <span className="text-muted-foreground mr-1 text-xs tabular-nums">
                                {selectedItems.length} selected
                            </span>
                            {selectedFiles.length > 0 && <Button
                                variant="outline"
                                size="sm"
                                disabled={pending}
                                onClick={() => downloadEntries(selectedItems)}
                            >
                                <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
                                <span className="hidden sm:inline">Download{selectedFiles.length > 1 ? ` (${selectedFiles.length})` : ''}</span>
                            </Button>}
                            {!readOnly && <Button
                                variant="destructive"
                                size="sm"
                                disabled={pending}
                                onClick={() => requestDelete(selectedItems)}
                            >
                                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                                <span className="hidden sm:inline">Delete</span>
                            </Button>}
                            <Button variant="ghost" size="sm" disabled={pending} onClick={clearSelection}>Clear</Button>
                        </> : !readOnly && <>
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
                        onContextMenu={(event) => { if (!(event.target as HTMLElement).closest('[data-entry-row]')) clearSelection(); }}
                        onClick={(event) => { if (!(event.target as HTMLElement).closest('[data-entry-row]')) clearSelection(); }}
                        onKeyDown={(event) => {
                            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
                                event.preventDefault();
                                setSelectedIds(orderedIds);
                                setSelectionAnchorId(orderedIds[0] ?? null);
                            }
                            if (event.key === 'Escape' && !renamingId && !creatingFolder) {
                                clearSelection();
                            }
                        }}
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
                                selected={selectedIdSet.has(document.id)}
                                selectionSize={selectedIdSet.has(document.id) ? selectedItems.length : 1}
                                selectionDownloadCount={selectedIdSet.has(document.id)
                                    ? selectedFiles.length
                                    : Number(document.entryKind === 'FILE' && Boolean(document.downloadHref))}
                                renaming={renamingId === document.id}
                                entryName={entryName}
                                pending={pending}
                                onSelect={(modifiers) => selectEntry(document.id, modifiers)}
                                onSelectForActions={() => selectForActions(document)}
                                onEntryNameChange={setEntryName}
                                onOpenFolder={() => navigateTo(document.id)}
                                onBeginRename={() => beginRename(document)}
                                onCancelRename={() => { setRenamingId(null); setEntryName(''); }}
                                onRename={() => void renameEntry(document)}
                                onDelete={() => requestDelete(actionTargets(document))}
                                onDownload={() => downloadEntries(actionTargets(document))}
                            />
                        ))}
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-60 rounded-lg">
                        <ContextMenuGroup>
                            <ContextMenuLabel className="py-1.5">{selectedItems.length > 1 ? `${selectedItems.length} items selected` : selectedItem ? selectedItem.name : `/${currentPathLabel}`}</ContextMenuLabel>
                            {selectedItem?.entryKind === 'FOLDER' && <ContextMenuItem onClick={() => navigateTo(selectedItem.id)}><HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />Open</ContextMenuItem>}
                            {selectedFiles.length > 0 && <ContextMenuItem onClick={() => downloadEntries(selectedItems)}><HugeiconsIcon icon={Download01Icon} strokeWidth={2} />{selectedFiles.length > 1 ? `Download ${selectedFiles.length} files` : 'Download'}</ContextMenuItem>}
                            {selectedItems.length > 0 && <ContextMenuSeparator />}
                            <ContextMenuItem disabled={readOnly || pending} onClick={startCreatingFolder}><HugeiconsIcon icon={FolderAddIcon} strokeWidth={2} />New folder</ContextMenuItem>
                            <ContextMenuItem disabled={readOnly || pending} onClick={() => fileRef.current?.click()}><HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />Upload files</ContextMenuItem>
                            <ContextMenuItem disabled={readOnly || pending} onClick={() => folderRef.current?.click()}><HugeiconsIcon icon={FolderUploadIcon} strokeWidth={2} />Upload folder</ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem disabled={!selectedItem || readOnly || pending} onClick={() => selectedItem && beginRename(selectedItem)}><HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />Rename selected</ContextMenuItem>
                            <ContextMenuItem variant="destructive" disabled={selectedItems.length === 0 || readOnly || pending} onClick={() => requestDelete(selectedItems)}><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />Delete selected{selectedItems.length > 1 ? ` (${selectedItems.length})` : ''}</ContextMenuItem>
                        </ContextMenuGroup>
                    </ContextMenuContent>
                </ContextMenu>

                <footer className="bg-muted/20 text-muted-foreground flex shrink-0 items-center justify-between border-t px-4 py-2 text-xs">
                    <span>{visibleEntries.length} {visibleEntries.length === 1 ? 'item' : 'items'}{selectedItems.length > 0 ? ` · ${selectedItems.length} selected` : ''}</span><span className="truncate pl-4 font-mono">/{currentPathLabel}</span>
                </footer>
            </section>

            {deleteTargets && <AlertDialog open onOpenChange={(open) => !open && !pending && setDeleteTargets(null)}>
                <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{deleteTargets?.length === 1 ? `Delete ${deleteTargets[0].name}?` : `Delete ${deleteTargets?.length ?? 0} items?`}</AlertDialogTitle>
                        <AlertDialogDescription>{deleteTargets?.length === 1
                            ? deleteTargets[0].entryKind === 'FOLDER'
                                ? 'This folder and every file or folder inside it will be permanently deleted.'
                                : 'This file and its stored content will be permanently deleted.'
                            : 'Every selected item will be permanently deleted. This also deletes everything inside any selected folders.'}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void deleteEntries()}>{pending && <Spinner />}Delete{deleteTargets && deleteTargets.length > 1 ? ` ${deleteTargets.length} items` : ''}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>}
        </div>
    );
}

function ExplorerRow({
    document, readOnly, selected, selectionSize, selectionDownloadCount, renaming, entryName, pending, onSelect,
    onSelectForActions, onEntryNameChange, onOpenFolder, onBeginRename, onCancelRename,
    onRename, onDelete, onDownload,
}: {
    document: DocumentItem;
    readOnly: boolean;
    selected: boolean;
    selectionSize: number;
    selectionDownloadCount: number;
    renaming: boolean;
    entryName: string;
    pending: boolean;
    onSelect: (modifiers: ExplorerSelectionModifiers) => void;
    onSelectForActions: () => void;
    onEntryNameChange: (value: string) => void;
    onOpenFolder: () => void;
    onBeginRename: () => void;
    onCancelRename: () => void;
    onRename: () => void;
    onDelete: () => void;
    onDownload: () => void;
}) {
    const name = document.name;
    const folder = document.entryKind === 'FOLDER';
    return <div
        data-entry-row
        role="row"
        tabIndex={0}
        aria-selected={selected}
        className="hover:bg-muted/35 focus-visible:ring-primary/40 aria-selected:bg-primary/[0.08] grid cursor-default select-none items-center gap-3 border-b px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset md:grid-cols-[minmax(16rem,1fr)_11rem_8rem_11rem_6rem]"
        onClick={(event) => onSelect(event)}
        onContextMenu={onSelectForActions}
        onDoubleClick={() => folder && onOpenFolder()}
        onKeyDown={(event) => {
            if (event.key === 'Enter' && folder && !renaming) onOpenFolder();
            if (event.key === ' ' && !renaming) {
                event.preventDefault();
                onSelect(event);
            }
        }}
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
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            {renaming ? <>
                <Button variant="ghost" size="icon-sm" onClick={onCancelRename} aria-label="Cancel rename"><span aria-hidden>×</span></Button>
                <Button size="icon-sm" disabled={!entryName.trim() || pending} onClick={onRename} aria-label="Save name">{pending ? <Spinner /> : <span aria-hidden>✓</span>}</Button>
            </> : <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button variant="ghost" size="icon-sm" aria-label={`Open actions for ${name}`} onPointerDown={onSelectForActions}>
                            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
                        </Button>
                    }
                />
                <DropdownMenuContent align="end" className="min-w-44 rounded-lg">
                    {folder && selectionSize <= 1 ? (
                        <DropdownMenuItem onClick={onOpenFolder}>
                            <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
                            Open
                        </DropdownMenuItem>
                    ) : selectionDownloadCount > 0 ? (
                        <DropdownMenuItem onClick={onDownload}>
                            <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
                            {selectionDownloadCount > 1 ? `Download ${selectionDownloadCount} files` : 'Download'}
                        </DropdownMenuItem>
                    ) : null}
                    {!readOnly && <>
                        {(folder || document.downloadHref) && <DropdownMenuSeparator />}
                        <DropdownMenuItem disabled={selectionSize > 1} onClick={onBeginRename}>
                            <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                            {selectionSize > 1 ? 'Rename one item at a time' : 'Rename'}
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={onDelete}>
                            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                            Delete{selectionSize > 1 ? ` ${selectionSize} items` : ''}
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
