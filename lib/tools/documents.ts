import 'server-only';

import { db } from '@/lib/db';

export const TOOL_DOCUMENT_SELECT = {
    id: true,
    name: true,
    parentFolderId: true,
    entryKind: true,
    contentHash: true,
    mimeType: true,
    sizeBytes: true,
    createdAt: true,
    updatedAt: true,
} as const;

export async function findToolDocument(workspaceId: string, documentId: string) {
    return db.document.findFirst({
        where: { id: documentId, workspaceId },
        select: TOOL_DOCUMENT_SELECT,
    });
}

export async function toolParentFolderExists(
    workspaceId: string,
    parentFolderId: string | null,
): Promise<boolean> {
    if (!parentFolderId) return true;
    return Boolean(
        await db.document.findFirst({
            where: { id: parentFolderId, workspaceId, entryKind: 'FOLDER' },
            select: { id: true },
        }),
    );
}

export async function toolMoveCreatesCycle(
    workspaceId: string,
    documentId: string,
    parentFolderId: string | null,
): Promise<boolean> {
    if (!parentFolderId) return false;
    const rows = await db.$queryRaw<Array<{ found: number }>>`
        WITH RECURSIVE descendants AS (
            SELECT "id"
            FROM "Document"
            WHERE "workspaceId" = ${workspaceId}::uuid
              AND "id" = ${documentId}::uuid

            UNION ALL

            SELECT child."id"
            FROM "Document" AS child
            JOIN descendants ON child."parentFolderId" = descendants."id"
            WHERE child."workspaceId" = ${workspaceId}::uuid
        )
        SELECT 1 AS found
        FROM descendants
        WHERE "id" = ${parentFolderId}::uuid
        LIMIT 1
    `;
    return rows.length > 0;
}

export function serializeToolDocument<T extends {
    createdAt: Date;
    updatedAt: Date;
}>(document: T) {
    return {
        ...document,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
    };
}

export function unquoteEtag(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim().replace(/^W\//, '');
    return trimmed.startsWith('"') && trimmed.endsWith('"')
        ? trimmed.slice(1, -1)
        : trimmed;
}
