import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import { errorResponse, invalidBodyResponse, invalidOriginResponse, jsonResponse } from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';
import { deleteObject, getObject } from '@/lib/storage/objects';
import { findOwnedWorkspace, isWorkspaceWritable } from '@/lib/workspaces/access';
import { normalizeDocumentPath } from '@/lib/workspaces/document-path';

const renameSchema = z.strictObject({ displayPath: z.string() });

async function access(userId: string, workspaceId: string, documentId: string) {
    if (!z.uuid().safeParse(workspaceId).success || !z.uuid().safeParse(documentId).success) return null;
    const workspace = await findOwnedWorkspace(userId, workspaceId);
    if (!workspace || !workspace.documents.some((document) => document.id === documentId)) return null;
    return workspace;
}

export async function GET(
    _request: NextRequest,
    { params }: RouteContext<'/api/workspaces/[workspaceId]/documents/[documentId]'>,
): Promise<NextResponse | Response> {
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');
    const { workspaceId, documentId } = await params;
    const workspace = await access(session.user.id, workspaceId, documentId);
    if (!workspace) return errorResponse(404, 'NOT_FOUND', 'Document not found');
    const document = workspace.documents.find((item) => item.id === documentId)!;
    const object = await getObject({ bucket: 'docs', key: documentId });
    if (!object) return errorResponse(404, 'NOT_FOUND', 'Document content not found');

    const filename = document.displayPath.split('/').at(-1) ?? 'document';
    return new Response(object.body, {
        headers: {
            'Content-Type': object.contentType,
            ...(object.contentLength ? { 'Content-Length': String(object.contentLength) } : {}),
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
            'Cache-Control': 'private, no-store',
        },
    });
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/workspaces/[workspaceId]/documents/[documentId]'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');
    const { workspaceId, documentId } = await params;
    const workspace = await access(session.user.id, workspaceId, documentId);
    if (!workspace) return errorResponse(404, 'NOT_FOUND', 'Document not found');
    if (!isWorkspaceWritable(workspace)) return errorResponse(409, 'RESOURCE_IN_USE', 'A submitted workspace is read-only');

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = renameSchema.safeParse(body.value);
    const displayPath = parsed.success ? normalizeDocumentPath(parsed.data.displayPath) : null;
    if (!displayPath) return errorResponse(400, 'VALIDATION_ERROR', 'Enter a safe display path');

    try {
        const document = await db.document.update({
            where: { id: documentId },
            data: { displayPath },
            select: { id: true, displayPath: true, updatedAt: true },
        });
        return jsonResponse({ document });
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
            return errorResponse(409, 'RESOURCE_IN_USE', 'A document already uses that path');
        }
        throw error;
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/workspaces/[workspaceId]/documents/[documentId]'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');
    const { workspaceId, documentId } = await params;
    const workspace = await access(session.user.id, workspaceId, documentId);
    if (!workspace) return errorResponse(404, 'NOT_FOUND', 'Document not found');
    if (!isWorkspaceWritable(workspace)) return errorResponse(409, 'RESOURCE_IN_USE', 'A submitted workspace is read-only');

    await db.document.delete({ where: { id: documentId } });
    try {
        await deleteObject({ bucket: 'docs', key: documentId });
    } catch {
        // Database state is authoritative; an orphaned object can be swept later.
    }
    return jsonResponse({ deleted: true });
}
