import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import { errorResponse, invalidBodyResponse, invalidOriginResponse, jsonResponse } from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';
import { deleteObject, getObject } from '@/lib/storage/objects';
import { findOwnedWorkspace, isWorkspaceWritable } from '@/lib/workspaces/access';
import { getDescendantFiles } from '@/lib/workspaces/document-tree';
import { normalizeDocumentName } from '@/lib/workspaces/document-path';

const renameSchema = z.strictObject({ name: z.string() });

async function access(userId: string, workspaceId: string, documentId: string) {
    if (!z.uuid().safeParse(workspaceId).success || !z.uuid().safeParse(documentId).success) return null;
    const workspace = await findOwnedWorkspace(userId, workspaceId);
    if (!workspace) return null;
    const document = await db.document.findFirst({
        where: { id: documentId, workspaceId },
    });
    return document ? { workspace, document } : null;
}

export async function GET(
    _request: NextRequest,
    { params }: RouteContext<'/api/workspaces/[workspaceId]/documents/[documentId]'>,
): Promise<NextResponse | Response> {
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');
    const { workspaceId, documentId } = await params;
    const result = await access(session.user.id, workspaceId, documentId);
    if (!result) return errorResponse(404, 'NOT_FOUND', 'Document not found');
    const { document } = result;
    if (document.entryKind !== 'FILE') {
        return errorResponse(409, 'RESOURCE_IN_USE', 'Folders do not have downloadable content');
    }
    const object = await getObject({ bucket: 'docs', key: documentId });
    if (!object) return errorResponse(404, 'NOT_FOUND', 'Document content not found');

    const filename = document.name;
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
    const result = await access(session.user.id, workspaceId, documentId);
    if (!result) return errorResponse(404, 'NOT_FOUND', 'Document not found');
    if (!isWorkspaceWritable(result.workspace)) return errorResponse(409, 'RESOURCE_IN_USE', 'A submitted workspace is read-only');

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = renameSchema.safeParse(body.value);
    const name = parsed.success ? normalizeDocumentName(parsed.data.name) : null;
    if (!name) return errorResponse(400, 'VALIDATION_ERROR', 'Enter a safe name');
    if (name === result.document.name) return jsonResponse({ document: result.document });

    try {
        const document = await db.document.update({
            where: { id: documentId },
            data: { name },
            select: {
                id: true,
                name: true,
                parentFolderId: true,
                entryKind: true,
                updatedAt: true,
            },
        });
        return jsonResponse({ document });
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
            return errorResponse(409, 'RESOURCE_IN_USE', 'An item already uses that name in this folder');
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
    const result = await access(session.user.id, workspaceId, documentId);
    if (!result) return errorResponse(404, 'NOT_FOUND', 'Document not found');
    if (!isWorkspaceWritable(result.workspace)) return errorResponse(409, 'RESOURCE_IN_USE', 'A submitted workspace is read-only');

    const removedFiles = await getDescendantFiles(workspaceId, documentId);
    await db.document.delete({ where: { id: documentId } });
    await Promise.allSettled(
        removedFiles.map((item) => deleteObject({ bucket: 'docs', key: item.id })),
    );
    return jsonResponse({ deleted: true });
}
