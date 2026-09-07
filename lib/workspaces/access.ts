import 'server-only';

import { db } from '@/lib/db';

function ownedWorkspaceWhere(userId: string, workspaceId: string) {
    return {
        id: workspaceId,
        OR: [
            { personal: { userId } },
            { assignment: { attempt: { userId } } },
        ],
    };
}

/** A workspace is owned either directly, or through the user's assessment attempt. */
export async function findOwnedWorkspace(userId: string, workspaceId: string) {
    return db.workspace.findFirst({
        where: ownedWorkspaceWhere(userId, workspaceId),
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
        },
    });
}

/** Lightweight lookup for layout chrome that deliberately does not load document rows. */
export async function findOwnedWorkspaceSummary(userId: string, workspaceId: string) {
    return db.workspace.findFirst({
        where: ownedWorkspaceWhere(userId, workspaceId),
        select: {
            id: true,
            name: true,
            personal: { select: { userId: true } },
            assignment: {
                select: {
                    attempt: { select: { submitAt: true } },
                },
            },
        },
    });
}

export function isWorkspaceWritable(workspace: {
    personal: { userId: string } | null;
    assignment: { attempt: { submitAt: Date | null } } | null;
}): boolean {
    return workspace.personal !== null || workspace.assignment?.attempt.submitAt === null;
}
