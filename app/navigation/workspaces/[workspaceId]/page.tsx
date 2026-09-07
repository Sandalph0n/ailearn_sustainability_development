import { notFound, redirect } from 'next/navigation';

import { WorkspaceDetail } from '@/components/navigation/workspaces/workspace-detail';
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

    return <main className="-mx-5 -mb-10 h-[calc(100dvh-4rem)] overflow-hidden md:-mx-6"><WorkspaceDetail workspaceId={workspace.id} readOnly={!isWorkspaceWritable(workspace)} documents={workspace.documents.map((document) => ({ id: document.id, displayPath: document.displayPath, entryKind: document.entryKind, hash: document.contentHash, mimeType: document.mimeType, sizeBytes: document.sizeBytes, updated: date.format(document.updatedAt), downloadHref: document.entryKind === 'FILE' ? `/api/workspaces/${workspace.id}/documents/${document.id}` : null }))} /></main>;
}
