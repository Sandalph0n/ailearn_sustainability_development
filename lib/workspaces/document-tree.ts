import 'server-only';

import { db } from '@/lib/db';

type BreadcrumbRow = {
    id: string;
    name: string;
    parentFolderId: string | null;
    depth: number;
};

export async function getWorkspaceFolderView(
    workspaceId: string,
    folderId: string | null,
) {
    if (folderId) {
        const currentFolder = await db.document.findFirst({
            where: { id: folderId, workspaceId, entryKind: 'FOLDER' },
            select: { id: true },
        });
        if (!currentFolder) return null;
    }

    const [entries, folderRows, breadcrumbs] = await Promise.all([
        db.document.findMany({
            where: { workspaceId, parentFolderId: folderId },
            orderBy: [{ entryKind: 'desc' }, { name: 'asc' }, { id: 'asc' }],
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
        }),
        db.document.findMany({
            where: { workspaceId, entryKind: 'FOLDER' },
            select: { id: true },
        }),
        folderId
            ? db.$queryRaw<BreadcrumbRow[]>`
                WITH RECURSIVE ancestors AS (
                    SELECT
                        document."id",
                        document."name",
                        document."parentFolderId",
                        0 AS depth
                    FROM "Document" AS document
                    WHERE document."workspaceId" = ${workspaceId}::uuid
                      AND document."id" = ${folderId}::uuid
                      AND document."entryKind" = 'FOLDER'

                    UNION ALL

                    SELECT
                        parent."id",
                        parent."name",
                        parent."parentFolderId",
                        ancestors.depth + 1
                    FROM "Document" AS parent
                    JOIN ancestors ON ancestors."parentFolderId" = parent."id"
                    WHERE parent."workspaceId" = ${workspaceId}::uuid
                      AND parent."entryKind" = 'FOLDER'
                )
                SELECT "id", "name", "parentFolderId", depth
                FROM ancestors
                ORDER BY depth DESC
            `
            : Promise.resolve([] as BreadcrumbRow[]),
    ]);

    return {
        entries,
        folderIds: folderRows.map((folder) => folder.id),
        breadcrumbs: breadcrumbs.map(({ id, name }) => ({ id, name })),
    };
}

export async function getDescendantFiles(workspaceId: string, documentId: string) {
    return getDescendantFilesForDocuments(workspaceId, [documentId]);
}

export async function getDescendantFilesForDocuments(
    workspaceId: string,
    documentIds: readonly string[],
) {
    if (documentIds.length === 0) return [];

    return db.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE requested AS (
            SELECT value::uuid AS "id"
            FROM jsonb_array_elements_text(${JSON.stringify(documentIds)}::jsonb)
        ),
        descendants AS (
            SELECT document."id", document."entryKind"
            FROM "Document" AS document
            JOIN requested ON requested."id" = document."id"
            WHERE document."workspaceId" = ${workspaceId}::uuid

            UNION

            SELECT child."id", child."entryKind"
            FROM "Document" AS child
            JOIN descendants ON child."parentFolderId" = descendants."id"
            WHERE child."workspaceId" = ${workspaceId}::uuid
        )
        SELECT DISTINCT "id"
        FROM descendants
        WHERE "entryKind" = 'FILE'
    `;
}
