import { createHash } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import { getObject, putObject } from '@/lib/storage/objects';
import { guardToolApi, guardToolWrite } from '@/lib/tools/api-auth';
import { findToolDocument, serializeToolDocument, unquoteEtag } from '@/lib/tools/documents';
import { MAX_DOCUMENT_BYTES } from '@/lib/workspaces/limits';

export const runtime = 'nodejs';

async function idFrom(context: RouteContext<'/api/tool/v1/documents/[documentId]/content'>) {
    const { documentId } = await context.params;
    return z.uuid().safeParse(documentId).success ? documentId : null;
}

export async function GET(
    request: NextRequest,
    context: RouteContext<'/api/tool/v1/documents/[documentId]/content'>,
): Promise<NextResponse | Response> {
    const guard = await guardToolApi(request, 'files:read');
    if (!guard.ok) return guard.response;
    const id = await idFrom(context);
    if (!id) return errorResponse(404, 'NOT_FOUND', 'Document not found');
    const document = await findToolDocument(guard.claims.assignmentWorkspaceId, id);
    if (!document || document.entryKind !== 'FILE') {
        return errorResponse(404, 'NOT_FOUND', 'File not found');
    }
    const object = await getObject({ bucket: 'docs', key: document.id });
    if (!object) return errorResponse(404, 'NOT_FOUND', 'Document content not found');

    return new Response(object.body, {
        headers: {
            'Content-Type': object.contentType,
            ...(object.contentLength !== undefined ? { 'Content-Length': String(object.contentLength) } : {}),
            ...(document.contentHash ? { ETag: `"${document.contentHash}"` } : {}),
            'Cache-Control': 'private, no-store',
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(document.name)}`,
        },
    });
}

export async function PUT(
    request: NextRequest,
    context: RouteContext<'/api/tool/v1/documents/[documentId]/content'>,
): Promise<NextResponse> {
    const guard = await guardToolApi(request, 'files:write');
    if (!guard.ok) return guard.response;
    const writeError = guardToolWrite(guard.claims);
    if (writeError) return writeError;
    const id = await idFrom(context);
    if (!id) return errorResponse(404, 'NOT_FOUND', 'Document not found');

    const expectedHash = unquoteEtag(request.headers.get('if-match'));
    if (!expectedHash) {
        return errorResponse(428, 'PRECONDITION_REQUIRED', 'If-Match must contain the last content hash');
    }
    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_DOCUMENT_BYTES) {
        return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Documents must be 20 MB or smaller');
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
        return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Documents must be 20 MB or smaller');
    }

    const result = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
        const current = await tx.document.findFirst({
            where: { id, workspaceId: guard.claims.assignmentWorkspaceId, entryKind: 'FILE' },
            select: { contentHash: true, mimeType: true },
        });
        if (!current) return { kind: 'missing' as const };
        if (current.contentHash !== expectedHash) {
            return { kind: 'stale' as const, contentHash: current.contentHash };
        }

        const contentHash = createHash('sha256').update(bytes).digest('hex');
        const mimeType = request.headers.get('content-type') || current.mimeType || 'application/octet-stream';
        await putObject({ bucket: 'docs', key: id, body: bytes, contentType: mimeType });
        const document = await tx.document.update({
            where: { id },
            data: { contentHash, mimeType, sizeBytes: bytes.byteLength },
            select: {
                id: true,
                name: true,
                parentFolderId: true,
                entryKind: true,
                contentHash: true,
                mimeType: true,
                sizeBytes: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return { kind: 'updated' as const, document };
    });

    if (result.kind === 'missing') return errorResponse(404, 'NOT_FOUND', 'File not found');
    if (result.kind === 'stale') {
        return errorResponse(
            412,
            'PRECONDITION_FAILED',
            'The document changed after it was read',
            undefined,
            { currentContentHash: result.contentHash },
        );
    }
    return jsonResponse(
        { document: serializeToolDocument(result.document) },
        { headers: { ETag: `"${result.document.contentHash}"` } },
    );
}
