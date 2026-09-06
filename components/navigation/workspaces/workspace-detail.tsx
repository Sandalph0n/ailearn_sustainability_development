'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Delete02Icon, Download01Icon, File01Icon, PencilEdit01Icon, Upload01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

type DocumentItem = { id: string; displayPath: string; hash: string; updated: string; downloadHref: string };

export function WorkspaceDetail({ workspaceId, initialName, personal, readOnly, documents }: { workspaceId: string; initialName: string; personal: boolean; readOnly: boolean; documents: DocumentItem[] }) {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [editingName, setEditingName] = useState(false);
    const [name, setName] = useState(initialName);
    const [uploading, setUploading] = useState(false);

    async function renameWorkspace() {
        const response = await fetch(`/api/workspaces/${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        if (!response.ok) return toast.error(body.error?.message ?? 'Could not rename workspace');
        setEditingName(false); toast.success('Workspace renamed.'); router.refresh();
    }

    async function upload(file: File) {
        setUploading(true);
        try {
            const form = new FormData(); form.set('file', file); form.set('displayPath', file.name);
            const response = await fetch(`/api/workspaces/${workspaceId}/documents`, { method: 'POST', body: form });
            const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
            if (!response.ok) throw new Error(body.error?.message ?? 'Could not upload document');
            toast.success(`${file.name} uploaded.`); router.refresh();
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not upload document'); }
        finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
    }

    async function removeDocument(document: DocumentItem) {
        if (!window.confirm(`Delete ${document.displayPath}?`)) return;
        const response = await fetch(`/api/workspaces/${workspaceId}/documents/${document.id}`, { method: 'DELETE' });
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        if (!response.ok) return toast.error(body.error?.message ?? 'Could not delete document');
        toast.success('Document deleted.'); router.refresh();
    }

    async function removeWorkspace() {
        if (!window.confirm(`Delete ${initialName} and all of its documents?`)) return;
        const response = await fetch(`/api/workspaces/${workspaceId}`, { method: 'DELETE' });
        if (!response.ok) return toast.error('Could not delete workspace');
        toast.success('Workspace deleted.'); router.push('/navigation/workspaces'); router.refresh();
    }

    return (
        <div className="space-y-6">
            <section className="bg-card rounded-xl border p-5">
                <div className="flex flex-wrap items-center gap-3">
                    {editingName ? <Input value={name} onChange={(event) => setName(event.target.value)} className="max-w-xl" autoFocus /> : <h2 className="font-heading min-w-0 flex-1 truncate text-xl font-semibold">{initialName}</h2>}
                    {!readOnly && (editingName ? <><Button variant="outline" onClick={() => { setName(initialName); setEditingName(false); }}>Cancel</Button><Button onClick={() => void renameWorkspace()}>Save name</Button></> : <Button variant="outline" onClick={() => setEditingName(true)}><HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />Rename</Button>)}
                    {personal && !editingName && <Button variant="outline" className="text-destructive" onClick={() => void removeWorkspace()}><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />Delete</Button>}
                </div>
                <p className="text-muted-foreground mt-2 text-sm">{personal ? 'Personal workspace · activity is not recorded.' : readOnly ? 'Submitted assessment workspace · read-only.' : 'Assessment workspace · changes remain available until submission.'}</p>
            </section>

            <section>
                <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="font-heading text-lg font-semibold">Documents</h2><p className="text-muted-foreground mt-1 text-sm">Paths are display names; stored content keeps a stable object key.</p></div>{!readOnly && <><input ref={fileRef} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /><Button disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <Spinner /> : <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />}Upload document</Button></>}</div>
                <div className="overflow-hidden rounded-xl border">
                    {documents.length === 0 ? <div className="text-muted-foreground px-6 py-12 text-center text-sm">No documents in this workspace yet.</div> : documents.map((document) => <div key={document.id} className="bg-card flex items-center gap-3 border-b px-4 py-3 last:border-b-0"><HugeiconsIcon icon={File01Icon} strokeWidth={2} className="text-muted-foreground size-5 shrink-0" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{document.displayPath}</p><p className="text-muted-foreground mt-0.5 truncate font-mono text-[0.68rem]">sha256 {document.hash.slice(0, 16)}… · {document.updated}</p></div><Button nativeButton={false} variant="ghost" size="icon-sm" aria-label={`Download ${document.displayPath}`} render={<a href={document.downloadHref} />}><HugeiconsIcon icon={Download01Icon} strokeWidth={2} /></Button>{!readOnly && <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Delete ${document.displayPath}`} onClick={() => void removeDocument(document)}><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} /></Button>}</div>)}
                </div>
            </section>
        </div>
    );
}
