import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import { errorResponse, invalidBodyResponse, invalidOriginResponse, jsonResponse } from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';
import { deleteObject } from '@/lib/storage/objects';
import { findOwnedWorkspace, isWorkspaceWritable } from '@/lib/workspaces/access';

const updateSchema = z.strictObject({
    name: z.string().trim().min(1, 'Enter a workspace name').max(120),
});

async function owned(userId: string, workspaceId: string) {
    if (!z.uuid().safeParse(workspaceId).success) return null;
    return findOwnedWorkspace(userId, workspaceId);
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/workspaces/[workspaceId]'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');

    const { workspaceId } = await params;
    const workspace = await owned(session.user.id, workspaceId);
    if (!workspace) return errorResponse(404, 'NOT_FOUND', 'Workspace not found');
    if (!isWorkspaceWritable(workspace)) {
        return errorResponse(409, 'RESOURCE_IN_USE', 'A submitted workspace is read-only');
    }

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = updateSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid workspace');
    }

    const updated = await db.workspace.update({
        where: { id: workspace.id },
        data: { name: parsed.data.name },
        select: { id: true, name: true },
    });
    return jsonResponse({ workspace: updated });
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/workspaces/[workspaceId]'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');

    const { workspaceId } = await params;
    const workspace = await owned(session.user.id, workspaceId);
    if (!workspace) return errorResponse(404, 'NOT_FOUND', 'Workspace not found');
    if (!workspace.personal) {
        return errorResponse(409, 'RESOURCE_IN_USE', 'Assessment workspaces cannot be deleted');
    }

    const objectKeys = workspace.documents
        .filter((document) => document.entryKind === 'FILE')
        .map((document) => document.id);
    await db.workspace.delete({ where: { id: workspace.id } });
    await Promise.allSettled(objectKeys.map((key) => deleteObject({ bucket: 'docs', key })));
    return jsonResponse({ deleted: true });
}
