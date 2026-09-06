import 'server-only';

import { db } from '@/lib/db';

/** A workspace is owned either directly, or through the user's assessment attempt. */
export async function findOwnedWorkspace(userId: string, workspaceId: string) {
    return db.workspace.findFirst({
        where: {
            id: workspaceId,
            OR: [
                { personal: { userId } },
                { assignment: { attempt: { userId } } },
            ],
        },
        select: {
            id: true,
            name: true,
            createdAt: true,
            lastOpenedAt: true,
            personal: { select: { userId: true } },
            assignment: {
                select: {
                    attempt: {
                        select: {
                            id: true,
                            submitAt: true,
                            assessment: {
                                select: {
                                    id: true,
                                    name: true,
                                    offering: {
                                        select: {
                                            id: true,
                                            subject: { select: { subjectCode: true } },
                                            term: { select: { year: true, session: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            documents: {
                orderBy: [{ displayPath: 'asc' }, { id: 'asc' }],
                select: {
                    id: true,
                    displayPath: true,
                    contentHash: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
        },
    });
}

export function isWorkspaceWritable(
    workspace: NonNullable<Awaited<ReturnType<typeof findOwnedWorkspace>>>,
): boolean {
    return workspace.personal !== null || workspace.assignment?.attempt.submitAt === null;
}
