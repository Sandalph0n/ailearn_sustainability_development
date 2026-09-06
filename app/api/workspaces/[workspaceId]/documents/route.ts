import { createHash, randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSameOriginRequest } from '@/lib/auth/http/request';
import { errorResponse, invalidOriginResponse, jsonResponse } from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';
import { putObject } from '@/lib/storage/objects';
import { findOwnedWorkspace, isWorkspaceWritable } from '@/lib/workspaces/access';
import { normalizeDocumentPath } from '@/lib/workspaces/document-path';

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/workspaces/[workspaceId]/documents'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');

    const { workspaceId } = await params;
    if (!z.uuid().safeParse(workspaceId).success) {
        return errorResponse(404, 'NOT_FOUND', 'Workspace not found');
    }
    const workspace = await findOwnedWorkspace(session.user.id, workspaceId);
    if (!workspace) return errorResponse(404, 'NOT_FOUND', 'Workspace not found');
    if (!isWorkspaceWritable(workspace)) {
        return errorResponse(409, 'RESOURCE_IN_USE', 'A submitted workspace is read-only');
    }

    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return errorResponse(400, 'VALIDATION_ERROR', 'Upload a valid document');
    }
    const file = form.get('file');
    const displayPath = normalizeDocumentPath(String(form.get('displayPath') ?? ''));
    if (!(file instanceof File) || file.size === 0 || !displayPath) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Choose a file and a safe display path');
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
        return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Documents must be 20 MB or smaller');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const documentId = randomUUID();
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    await putObject({
        bucket: 'docs',
        key: documentId,
        body: bytes,
        contentType: file.type || 'application/octet-stream',
    });

    try {
        const document = await db.document.create({
            data: { id: documentId, workspaceId, displayPath, contentHash },
            select: { id: true, displayPath: true, contentHash: true, createdAt: true, updatedAt: true },
        });
        return jsonResponse({ document }, { status: 201 });
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
            return errorResponse(409, 'RESOURCE_IN_USE', 'A document already uses that path');
        }
        throw error;
    }
}
