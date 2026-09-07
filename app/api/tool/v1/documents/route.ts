import { createHash, randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { errorResponse, invalidBodyResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import { deleteObject, putObject } from '@/lib/storage/objects';
import { guardToolApi, guardToolWrite } from '@/lib/tools/api-auth';
import { readToolJson } from '@/lib/tools/api-request';
import {
    MAX_DOCUMENTS_PER_PAGE,
    ToolDocumentCreateSchema,
} from '@/lib/tools/api-contract';
import {
    serializeToolDocument,
    TOOL_DOCUMENT_SELECT,
    toolParentFolderExists,
} from '@/lib/tools/documents';
import { normalizeDocumentName } from '@/lib/workspaces/document-path';
import { MAX_DOCUMENT_BYTES } from '@/lib/workspaces/limits';

export const runtime = 'nodejs';

function conflict() {
    return errorResponse(409, 'RESOURCE_IN_USE', 'An item already uses that name in this folder');
}

function isUniqueConflict(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    const guard = await guardToolApi(request, 'files:read');
    if (!guard.ok) return guard.response;

    const rawParent = request.nextUrl.searchParams.get('parentFolderId');
    const parentFolderId = !rawParent || rawParent === 'root' ? null : rawParent;
    if (parentFolderId && !z.uuid().safeParse(parentFolderId).success) {
        return errorResponse(400, 'VALIDATION_ERROR', 'parentFolderId must be a UUID or root');
    }
    if (!(await toolParentFolderExists(guard.claims.assignmentWorkspaceId, parentFolderId))) {
        return errorResponse(404, 'NOT_FOUND', 'Folder not found');
    }

    const rawLimit = Number(request.nextUrl.searchParams.get('limit') ?? 100);
    const limit = Number.isInteger(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), MAX_DOCUMENTS_PER_PAGE)
        : 100;
    const cursor = request.nextUrl.searchParams.get('cursor');
    if (cursor && !z.uuid().safeParse(cursor).success) {
        return errorResponse(400, 'VALIDATION_ERROR', 'cursor must be a document UUID');
    }

    const rows = await db.document.findMany({
        where: {
            workspaceId: guard.claims.assignmentWorkspaceId,
            parentFolderId,
        },
        orderBy: [{ entryKind: 'desc' }, { name: 'asc' }, { id: 'asc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
        select: TOOL_DOCUMENT_SELECT,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return jsonResponse({
        documents: page.map(serializeToolDocument),
        nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = await guardToolApi(request, 'files:write');
    if (!guard.ok) return guard.response;
    const writeError = guardToolWrite(guard.claims);
    if (writeError) return writeError;

    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() === 'application/json') {
        const body = await readToolJson(request, 16 * 1024);
        if (!body.ok) return invalidBodyResponse(body.reason);
        const parsed = ToolDocumentCreateSchema.safeParse(body.value);
        const name = parsed.success ? normalizeDocumentName(parsed.data.name) : null;
        const parentFolderId = parsed.success ? parsed.data.parentFolderId ?? null : null;
        if (!parsed.success || !name) {
            return errorResponse(400, 'VALIDATION_ERROR', 'Enter a safe file or folder name');
        }
        if (!(await toolParentFolderExists(guard.claims.assignmentWorkspaceId, parentFolderId))) {
            return errorResponse(400, 'VALIDATION_ERROR', 'The parent folder does not exist');
        }

        const id = randomUUID();
        const isFile = parsed.data.entryKind === 'FILE';
        if (isFile) {
            await putObject({
                bucket: 'docs',
                key: id,
                body: new Uint8Array(),
                contentType: 'text/plain; charset=utf-8',
            });
        }
        try {
            const document = await db.document.create({
                data: {
                    id,
                    workspaceId: guard.claims.assignmentWorkspaceId,
                    parentFolderId,
                    name,
                    entryKind: parsed.data.entryKind,
                    ...(isFile
                        ? {
                              contentHash: createHash('sha256').update(new Uint8Array()).digest('hex'),
                              mimeType: 'text/plain; charset=utf-8',
                              sizeBytes: 0,
                          }
                        : {}),
                },
                select: TOOL_DOCUMENT_SELECT,
            });
            return jsonResponse({ document: serializeToolDocument(document) }, { status: 201 });
        } catch (error) {
            if (isFile) await deleteObject({ bucket: 'docs', key: id }).catch(() => undefined);
            if (isUniqueConflict(error)) return conflict();
            throw error;
        }
    }

    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return errorResponse(400, 'VALIDATION_ERROR', 'Upload a valid document');
    }
    const file = form.get('file');
    const name = normalizeDocumentName(String(form.get('name') ?? (file instanceof File ? file.name : '')));
    const rawParent = String(form.get('parentFolderId') ?? '');
    const parentFolderId = rawParent || null;
    if (
        !(file instanceof File) ||
        !name ||
        (parentFolderId !== null && !z.uuid().safeParse(parentFolderId).success)
    ) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Choose a file and a safe name');
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
        return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Documents must be 20 MB or smaller');
    }
    if (!(await toolParentFolderExists(guard.claims.assignmentWorkspaceId, parentFolderId))) {
        return errorResponse(400, 'VALIDATION_ERROR', 'The parent folder does not exist');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const id = randomUUID();
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    await putObject({
        bucket: 'docs',
        key: id,
        body: bytes,
        contentType: file.type || 'application/octet-stream',
    });
    try {
        const document = await db.document.create({
            data: {
                id,
                workspaceId: guard.claims.assignmentWorkspaceId,
                parentFolderId,
                name,
                entryKind: 'FILE',
                contentHash,
                mimeType: file.type || 'application/octet-stream',
                sizeBytes: file.size,
            },
            select: TOOL_DOCUMENT_SELECT,
        });
        return jsonResponse({ document: serializeToolDocument(document) }, { status: 201 });
    } catch (error) {
        await deleteObject({ bucket: 'docs', key: id }).catch(() => undefined);
        if (isUniqueConflict(error)) return conflict();
        throw error;
    }
}
