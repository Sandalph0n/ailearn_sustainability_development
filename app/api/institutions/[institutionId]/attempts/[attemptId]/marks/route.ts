import { NextRequest, NextResponse } from 'next/server';

import { Prisma } from '@/app/generated/prisma/client';
import { badId, prismaError } from '@/lib/admin/route-helpers';
import { jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { guardAttemptAction } from '@/lib/marking/attempt-route-guard';

export const runtime = 'nodejs';

/** Start a resumable draft, or return the marker's existing draft for this attempt. */
export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/attempts/[attemptId]/marks'>,
): Promise<NextResponse> {
    const { institutionId, attemptId } = await params;
    const invalid = badId(institutionId) ?? badId(attemptId);
    if (invalid) return invalid;

    const guard = await guardAttemptAction(
        request,
        institutionId,
        attemptId,
        PERMISSION_CODE.ATTEMPT_MARK,
    );
    if (!guard.ok) return guard.response;

    try {
        const result = await db.$transaction(async (tx) => {
            const existing = await tx.assessmentAttemptMark.findFirst({
                where: {
                    attemptId,
                    markedById: guard.session.user.id,
                    status: 'DRAFT',
                },
                orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            });
            if (existing) return { mark: existing, created: false };

            const previous = await tx.assessmentAttemptMark.findFirst({
                where: {
                    attemptId,
                    markedById: guard.session.user.id,
                    status: { in: ['SUBMITTED', 'SUPERSEDED'] },
                },
                orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
                select: { id: true },
            });
            const mark = await tx.assessmentAttemptMark.create({
                data: {
                    attemptId,
                    markedById: guard.session.user.id,
                    supersedesMarkId: previous?.id,
                },
            });
            return { mark, created: true };
        });

        return jsonResponse(
            {
                mark: {
                    ...result.mark,
                    score: result.mark.score?.toString() ?? null,
                    outOf: result.mark.outOf.toString(),
                },
            },
            { status: result.created ? 201 : 200 },
        );
    } catch (error) {
        // A concurrent double-click can pass both preflight reads. The partial unique index is
        // the source of truth; return the winning draft instead of surfacing a transient 500.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const existing = await db.assessmentAttemptMark.findFirst({
                where: {
                    attemptId,
                    markedById: guard.session.user.id,
                    status: 'DRAFT',
                },
                orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            });
            if (existing) {
                return jsonResponse({
                    mark: {
                        ...existing,
                        score: existing.score?.toString() ?? null,
                        outOf: existing.outOf.toString(),
                    },
                });
            }
        }
        return prismaError(error, 'Mark');
    }
}
