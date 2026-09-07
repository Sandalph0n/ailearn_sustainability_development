import { createHash, randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
    jsonResponse,
} from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';
import { putObject } from '@/lib/storage/objects';
import { findOwnedWorkspace, isWorkspaceWritable } from '@/lib/workspaces/access';
import { normalizeDocumentName } from '@/lib/workspaces/document-path';

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const folderSchema = z.strictObject({
    entryKind: z.literal('FOLDER'),
    name: z.string(),
    parentFolderId: z.uuid().nullable().optional(),
    reuseExisting: z.boolean().optional(),
});

async function parentFolderExists(workspaceId: string, parentFolderId: string | null): Promise<boolean> {
    if (!parentFolderId) return true;
    return Boolean(
        await db.document.findFirst({
            where: { workspaceId, id: parentFolderId, entryKind: 'FOLDER' },
            select: { id: true },
        }),
    );
}

function conflictResponse() {
    return errorResponse(409, 'RESOURCE_IN_USE', 'An item already uses that name in this folder');
}

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

    if (request.headers.get('content-type')?.includes('application/json')) {
        const body = await readAuthJson(request);
        if (!body.ok) return invalidBodyResponse(body.reason);
        const parsed = folderSchema.safeParse(body.value);
        const name = parsed.success ? normalizeDocumentName(parsed.data.name) : null;
        const parentFolderId = parsed.success ? parsed.data.parentFolderId ?? null : null;
        if (!parsed.success || !name) {
            return errorResponse(400, 'VALIDATION_ERROR', 'Enter a safe folder name');
        }
        if (!(await parentFolderExists(workspaceId, parentFolderId))) {
            return errorResponse(400, 'VALIDATION_ERROR', 'The parent folder does not exist');
        }

        try {
            const document = await db.document.create({
                data: { workspaceId, name, parentFolderId, entryKind: 'FOLDER' },
                select: {
                    id: true,
                    name: true,
                    parentFolderId: true,
                    entryKind: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            return jsonResponse({ document }, { status: 201 });
        } catch (error) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'P2002'
            ) {
                if (parsed.data.reuseExisting) {
                    const existing = await db.document.findFirst({
                        where: { workspaceId, parentFolderId, name, entryKind: 'FOLDER' },
                        select: {
                            id: true,
                            name: true,
                            parentFolderId: true,
                            entryKind: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                    });
                    if (existing) return jsonResponse({ document: existing });
                }
                return conflictResponse();
            }
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
    const name = normalizeDocumentName(String(form.get('name') ?? ''));
    const rawParentFolderId = String(form.get('parentFolderId') ?? '');
    const parentFolderId = rawParentFolderId || null;
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
    if (!(await parentFolderExists(workspaceId, parentFolderId))) {
        return errorResponse(400, 'VALIDATION_ERROR', 'The parent folder does not exist');
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
            data: {
                id: documentId,
                workspaceId,
                name,
                parentFolderId,
                entryKind: 'FILE',
                contentHash,
                mimeType: file.type || 'application/octet-stream',
                sizeBytes: file.size,
            },
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
        return jsonResponse({ document }, { status: 201 });
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
            return conflictResponse();
        }
        throw error;
    }
}
