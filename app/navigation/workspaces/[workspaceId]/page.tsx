import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { WorkspaceDetail } from '@/components/navigation/workspaces/workspace-detail';
import { Button } from '@/components/ui/button';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';
import { findOwnedWorkspace, isWorkspaceWritable } from '@/lib/workspaces/access';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({ params }: PageProps<'/navigation/workspaces/[workspaceId]'>) {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');
    const { workspaceId } = await params;
    const workspace = await findOwnedWorkspace(session.user.id, workspaceId);
    if (!workspace) notFound();
    await db.workspace.update({ where: { id: workspace.id }, data: { lastOpenedAt: new Date() } });
    const date = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Sydney' });

    return <main className="mx-auto w-full max-w-7xl py-7"><Button nativeButton={false} variant="ghost" size="sm" className="-ml-3 mb-4" render={<Link href="/navigation/workspaces" />}><HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />Workspaces</Button><WorkspaceDetail workspaceId={workspace.id} initialName={workspace.name} personal={workspace.personal !== null} readOnly={!isWorkspaceWritable(workspace)} documents={workspace.documents.map((document) => ({ id: document.id, displayPath: document.displayPath, entryKind: document.entryKind, hash: document.contentHash, mimeType: document.mimeType, sizeBytes: document.sizeBytes, updated: date.format(document.updatedAt), downloadHref: document.entryKind === 'FILE' ? `/api/workspaces/${workspace.id}/documents/${document.id}` : null }))} /></main>;
}
