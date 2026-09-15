'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Add01Icon, ArrowRight01Icon, File01Icon, Folder01Icon, LockIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export type WorkspaceSummary = {
    id: string;
    name: string;
    kind: 'PERSONAL' | 'ASSIGNMENT';
    detail: string;
    updated: string;
    documentCount: number;
    submitted: boolean;
    attemptNumber?: number;
    started?: string;
    href: string;
};

export function WorkspaceList({ workspaces }: { workspaces: WorkspaceSummary[] }) {
    const router = useRouter();
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [pending, setPending] = useState(false);

    async function createWorkspace() {
        if (!name.trim() || pending) return;
        setPending(true);
        try {
            const response = await fetch('/api/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const body = (await response.json().catch(() => ({}))) as { workspace?: { id: string }; error?: { message?: string } };
            if (!response.ok || !body.workspace) throw new Error(body.error?.message ?? 'Could not create workspace');
            toast.success('Personal workspace created.');
            router.push(`/navigation/workspaces/${body.workspace.id}`);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not create workspace');
        } finally {
            setPending(false);
        }
    }

    if (creating) {
        return (
            <section className="border-border/80 bg-card rounded-xl border p-6 sm:p-8">
                <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">New personal workspace</p>
                <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div>
                        <label htmlFor="workspace-name" className="text-sm font-medium">Workspace name</label>
                        <Input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2" maxLength={120} autoFocus onKeyDown={(event) => { if (event.key === 'Enter') void createWorkspace(); }} />
                    </div>
                    <aside className="bg-muted/35 rounded-lg border p-4 text-sm leading-6">
                        <p className="font-medium">Private by design</p>
                        <p className="text-muted-foreground mt-1">Personal workspaces store your documents, but do not create work sessions or event history.</p>
                    </aside>
                </div>
                <div className="mt-7 flex justify-end gap-2 border-t pt-5">
                    <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
                    <Button disabled={!name.trim() || pending} onClick={() => void createWorkspace()}>{pending && <Spinner />}Create workspace</Button>
                </div>
            </section>
        );
    }

    const personal = workspaces.filter((workspace) => workspace.kind === 'PERSONAL');
    const assignments = workspaces.filter((workspace) => workspace.kind === 'ASSIGNMENT');

    return (
        <div className="space-y-8">
            <WorkspaceGroup title="Your assessment work" description="Workspaces created from assessment attempts owned by this account." items={assignments} empty="No assessment workspaces belong to this account." />
            <WorkspaceGroup title="Personal work" description="Private notes, drafts and files with no activity recording." items={personal} empty="Create a personal workspace for notes and independent work." action={<Button onClick={() => setCreating(true)}><HugeiconsIcon icon={Add01Icon} strokeWidth={2} />New workspace</Button>} />
        </div>
    );
}

function WorkspaceGroup({ title, description, items, empty, action }: { title: string; description: string; items: WorkspaceSummary[]; empty: string; action?: React.ReactNode }) {
    return (
        <section>
            <div className="mb-3 flex items-end justify-between gap-4">
                <div><h2 className="font-heading text-lg font-semibold">{title}</h2><p className="text-muted-foreground mt-1 text-sm">{description}</p></div>
                {action}
            </div>
            {items.length === 0 ? (
                <div className="text-muted-foreground rounded-xl border border-dashed px-5 py-10 text-center text-sm">{empty}</div>
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    {items.map((workspace) => (
                        <Link key={workspace.id} href={workspace.href} className="group bg-card hover:border-primary/35 flex min-w-0 items-center gap-4 rounded-xl border p-4 transition-colors">
                            <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"><HugeiconsIcon icon={workspace.kind === 'PERSONAL' ? Folder01Icon : workspace.submitted ? LockIcon : File01Icon} strokeWidth={2} className="size-5" /></div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate font-medium">{workspace.name}</p>
                                    {workspace.attemptNumber !== undefined && (
                                        <span className="bg-primary/8 text-primary rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">
                                            Attempt {workspace.attemptNumber}
                                        </span>
                                    )}
                                    {workspace.kind === 'ASSIGNMENT' && (
                                        <span className="bg-muted rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">
                                            {workspace.submitted ? 'Submitted' : 'Active'}
                                        </span>
                                    )}
                                </div>
                                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                    {workspace.detail}{workspace.started ? ` · Started ${workspace.started}` : ''}
                                </p>
                                <p className="text-muted-foreground mt-2 text-xs">
                                    {workspace.documentCount} items · Last opened {workspace.updated}
                                </p>
                            </div>
                            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}
