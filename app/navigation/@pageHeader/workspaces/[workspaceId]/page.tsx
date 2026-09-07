import { notFound, redirect } from 'next/navigation';

import { WorkspaceHeader } from '@/components/navigation/workspaces/workspace-header';
import { getCurrentSession } from '@/lib/auth/session/service';
import { findOwnedWorkspaceSummary, isWorkspaceWritable } from '@/lib/workspaces/access';

export default async function WorkspacePageHeader({
    params,
}: PageProps<'/navigation/workspaces/[workspaceId]'>) {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const { workspaceId } = await params;
    const workspace = await findOwnedWorkspaceSummary(session.user.id, workspaceId);
    if (!workspace) notFound();

    return (
        <WorkspaceHeader
            workspaceId={workspace.id}
            initialName={workspace.name}
            personal={workspace.personal !== null}
            readOnly={!isWorkspaceWritable(workspace)}
        />
    );
}
