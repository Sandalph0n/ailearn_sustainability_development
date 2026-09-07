import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { Prisma } from '@/app/generated/prisma/client';
import { errorResponse, invalidBodyResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import { deleteObject } from '@/lib/storage/objects';
import { guardToolApi, guardToolWrite } from '@/lib/tools/api-auth';
import { ToolDocumentUpdateSchema } from '@/lib/tools/api-contract';
import { readToolJson } from '@/lib/tools/api-request';
import {
    findToolDocument,
    serializeToolDocument,
    TOOL_DOCUMENT_SELECT,
    toolMoveCreatesCycle,
    toolParentFolderExists,
} from '@/lib/tools/documents';
import { getDescendantFiles } from '@/lib/workspaces/document-tree';
import { normalizeDocumentName } from '@/lib/workspaces/document-path';

export const runtime = 'nodejs';

async function documentId(context: RouteContext<'/api/tool/v1/documents/[documentId]'>) {
    const { documentId } = await context.params;
    return z.uuid().safeParse(documentId).success ? documentId : null;
}

export async function GET(
    request: NextRequest,
    context: RouteContext<'/api/tool/v1/documents/[documentId]'>,
): Promise<NextResponse> {
    const guard = await guardToolApi(request, 'files:read');
    if (!guard.ok) return guard.response;
    const id = await documentId(context);
    if (!id) return errorResponse(404, 'NOT_FOUND', 'Document not found');
    const document = await findToolDocument(guard.claims.assignmentWorkspaceId, id);
    if (!document) return errorResponse(404, 'NOT_FOUND', 'Document not found');
    return jsonResponse({ document: serializeToolDocument(document) });
}

export async function PATCH(
    request: NextRequest,
    context: RouteContext<'/api/tool/v1/documents/[documentId]'>,
): Promise<NextResponse> {
    const guard = await guardToolApi(request, 'files:write');
    if (!guard.ok) return guard.response;
    const writeError = guardToolWrite(guard.claims);
    if (writeError) return writeError;
    const id = await documentId(context);
    if (!id) return errorResponse(404, 'NOT_FOUND', 'Document not found');
    const current = await findToolDocument(guard.claims.assignmentWorkspaceId, id);
    if (!current) return errorResponse(404, 'NOT_FOUND', 'Document not found');

    const body = await readToolJson(request, 16 * 1024);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = ToolDocumentUpdateSchema.safeParse(body.value);
    const name = parsed.success && parsed.data.name !== undefined
        ? normalizeDocumentName(parsed.data.name)
        : undefined;
    if (!parsed.success || (parsed.data.name !== undefined && !name)) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Document update is invalid');
    }
    const safeName: string | undefined = parsed.data.name === undefined ? undefined : name ?? undefined;
    const parentFolderId = parsed.data.parentFolderId;
    if (
        parentFolderId !== undefined &&
        (!(await toolParentFolderExists(guard.claims.assignmentWorkspaceId, parentFolderId)) || parentFolderId === id)
    ) {
        return errorResponse(400, 'VALIDATION_ERROR', 'The destination folder is invalid');
    }
    if (
        current.entryKind === 'FOLDER' &&
        parentFolderId !== undefined &&
        (await toolMoveCreatesCycle(guard.claims.assignmentWorkspaceId, id, parentFolderId))
    ) {
        return errorResponse(409, 'RESOURCE_IN_USE', 'A folder cannot be moved inside itself');
    }

    try {
        const data: Prisma.DocumentUncheckedUpdateInput = {
            ...(safeName !== undefined ? { name: safeName } : {}),
            ...(parentFolderId !== undefined ? { parentFolderId } : {}),
        };
        const document = await db.document.update({
            where: { id },
            data,
            select: TOOL_DOCUMENT_SELECT,
        });
        return jsonResponse({ document: serializeToolDocument(document) });
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
            return errorResponse(409, 'RESOURCE_IN_USE', 'An item already uses that name in this folder');
        }
        if (
            error instanceof Error &&
            (error.message.includes('Document hierarchy') || error.message.includes('P2010'))
        ) {
            return errorResponse(409, 'RESOURCE_IN_USE', 'A folder cannot be moved inside itself');
        }
        throw error;
    }
}

export async function DELETE(
    request: NextRequest,
    context: RouteContext<'/api/tool/v1/documents/[documentId]'>,
): Promise<NextResponse> {
    const guard = await guardToolApi(request, 'files:write');
    if (!guard.ok) return guard.response;
    const writeError = guardToolWrite(guard.claims);
    if (writeError) return writeError;
    const id = await documentId(context);
    if (!id) return errorResponse(404, 'NOT_FOUND', 'Document not found');
    const document = await findToolDocument(guard.claims.assignmentWorkspaceId, id);
    if (!document) return errorResponse(404, 'NOT_FOUND', 'Document not found');

    const files = await getDescendantFiles(guard.claims.assignmentWorkspaceId, id);
    await db.document.delete({ where: { id } });
    await Promise.allSettled(files.map((file) => deleteObject({ bucket: 'docs', key: file.id })));
    return jsonResponse({ deleted: true, deletedFiles: files.length });
}
