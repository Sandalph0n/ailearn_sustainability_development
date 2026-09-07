import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import { errorResponse, invalidBodyResponse, invalidOriginResponse, jsonResponse } from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';
import { deleteObject, getObject } from '@/lib/storage/objects';
import { findOwnedWorkspace, isWorkspaceWritable } from '@/lib/workspaces/access';
import {
    documentParentPath,
    normalizeDocumentPath,
} from '@/lib/workspaces/document-path';

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
    if (document.entryKind !== 'FILE') {
        return errorResponse(409, 'RESOURCE_IN_USE', 'Folders do not have downloadable content');
    }
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

    const current = workspace.documents.find((item) => item.id === documentId)!;
    if (displayPath === current.displayPath) {
        return jsonResponse({ document: current });
    }
    if (
        current.entryKind === 'FOLDER' &&
        displayPath.startsWith(`${current.displayPath}/`)
    ) {
        return errorResponse(400, 'VALIDATION_ERROR', 'A folder cannot be moved inside itself');
    }

    const parentPath = documentParentPath(displayPath);
    if (
        parentPath &&
        !workspace.documents.some(
            (item) => item.displayPath === parentPath && item.entryKind === 'FOLDER',
        )
    ) {
        return errorResponse(400, 'VALIDATION_ERROR', 'The destination folder does not exist');
    }

    const affected =
        current.entryKind === 'FOLDER'
            ? workspace.documents.filter(
                  (item) =>
                      item.id === current.id ||
                      item.displayPath.startsWith(`${current.displayPath}/`),
              )
            : [current];
    const moves = affected.map((item) => ({
        id: item.id,
        displayPath:
            item.id === current.id
                ? displayPath
                : `${displayPath}${item.displayPath.slice(current.displayPath.length)}`,
    }));
    if (moves.some((move) => !normalizeDocumentPath(move.displayPath))) {
        return errorResponse(400, 'VALIDATION_ERROR', 'A resulting path is too long');
    }

    const conflict = await db.document.findFirst({
        where: {
            workspaceId,
            id: { notIn: affected.map((item) => item.id) },
            displayPath: { in: moves.map((move) => move.displayPath) },
        },
        select: { id: true },
    });
    if (conflict) {
        return errorResponse(409, 'RESOURCE_IN_USE', 'An item already uses that path');
    }

    try {
        const document = await db.$transaction(async (tx) => {
            for (const move of moves) {
                await tx.document.update({
                    where: { id: move.id },
                    data: { displayPath: move.displayPath },
                });
            }
            return tx.document.findUniqueOrThrow({
                where: { id: documentId },
                select: {
                    id: true,
                    displayPath: true,
                    entryKind: true,
                    updatedAt: true,
                },
            });
        });
        return jsonResponse({ document });
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
            return errorResponse(409, 'RESOURCE_IN_USE', 'An item already uses that path');
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

    const current = workspace.documents.find((item) => item.id === documentId)!;
    const removed =
        current.entryKind === 'FOLDER'
            ? workspace.documents.filter(
                  (item) =>
                      item.id === current.id ||
                      item.displayPath.startsWith(`${current.displayPath}/`),
              )
            : [current];

    await db.document.deleteMany({ where: { id: { in: removed.map((item) => item.id) } } });
    await Promise.allSettled(
        removed
            .filter((item) => item.entryKind === 'FILE')
            .map((item) => deleteObject({ bucket: 'docs', key: item.id })),
    );
    return jsonResponse({ deleted: true, removedCount: removed.length });
}
