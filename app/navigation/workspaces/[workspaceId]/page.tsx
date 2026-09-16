import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';

import { WorkspaceDetail } from '@/components/navigation/workspaces/workspace-detail';
import { getCurrentSession } from '@/lib/auth/session/service';
import { resolveActiveContext } from '@/lib/context/active-context';
import { db } from '@/lib/db';
import { findOwnedWorkspace, isWorkspaceWritable } from '@/lib/workspaces/access';
import { getWorkspaceFolderView } from '@/lib/workspaces/document-tree';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({
    params,
    searchParams,
}: PageProps<'/navigation/workspaces/[workspaceId]'>) {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');
    const { workspaceId } = await params;
    const query = await searchParams;
    const rawFolderId = typeof query.folder === 'string' ? query.folder : null;
    if (rawFolderId && !z.uuid().safeParse(rawFolderId).success) {
        redirect(`/navigation/workspaces/${workspaceId}`);
    }
    const requestedFolderId = rawFolderId;
    const workspace = await findOwnedWorkspace(session.user.id, workspaceId);
    if (!workspace) notFound();
    const { active } = await resolveActiveContext(session.user.id, query);
    const folderView = await getWorkspaceFolderView(workspace.id, requestedFolderId);
    if (!folderView) redirect(`/navigation/workspaces/${workspace.id}`);
    await db.workspace.update({ where: { id: workspace.id }, data: { lastOpenedAt: new Date() } });
    const tools = await db.tool.findMany({
        where: workspace.personal
            ? { activeVersionId: { not: null } }
            : {
                  activeVersionId: { not: null },
                  assessments: {
                      some: { assessmentId: workspace.assignment!.attempt.assessment.id },
                  },
              },
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true, description: true },
    });
    const date = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Sydney' });

    const toolLaunch = active
        ? workspace.personal
            ? {
                  mode: 'PERSONAL' as const,
                  workspaceId: workspace.id,
                  roleAssignmentId: active.assignmentId,
              }
            : {
                  mode: 'WORK' as const,
                  attemptId: workspace.assignment!.attempt.id,
                  roleAssignmentId: active.assignmentId,
              }
        : null;

    return <main className="-mx-5 -mb-10 h-[calc(100dvh-4rem)] overflow-hidden md:-mx-6"><WorkspaceDetail workspaceId={workspace.id} readOnly={!isWorkspaceWritable(workspace)} currentFolderId={requestedFolderId} folderIds={folderView.folderIds} breadcrumbs={folderView.breadcrumbs} documents={folderView.entries.map((document) => ({ id: document.id, name: document.name, parentFolderId: document.parentFolderId, entryKind: document.entryKind, hash: document.contentHash, mimeType: document.mimeType, sizeBytes: document.sizeBytes, updated: date.format(document.updatedAt), downloadHref: document.entryKind === 'FILE' ? `/api/workspaces/${workspace.id}/documents/${document.id}` : null }))} tools={tools} toolLaunch={toolLaunch} /></main>;
}
