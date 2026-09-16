import { NextRequest, NextResponse } from 'next/server';

import { badId, prismaError } from '@/lib/admin/route-helpers';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { guardAttemptAction } from '@/lib/marking/attempt-route-guard';

export const runtime = 'nodejs';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/attempts/[attemptId]/marks/[markId]/submit'>,
): Promise<NextResponse> {
    const { institutionId, attemptId, markId } = await params;
    const invalid = badId(institutionId) ?? badId(attemptId) ?? badId(markId);
    if (invalid) return invalid;

    const guard = await guardAttemptAction(
        request,
        institutionId,
        attemptId,
        PERMISSION_CODE.ATTEMPT_MARK,
    );
    if (!guard.ok) return guard.response;

    try {
        const mark = await db.$transaction(async (tx) => {
            const draft = await tx.assessmentAttemptMark.findFirst({
                where: {
                    id: markId,
                    attemptId,
                    markedById: guard.session.user.id,
                    status: 'DRAFT',
                },
                select: { id: true, score: true, supersedesMarkId: true },
            });
            if (!draft) return null;
            if (draft.score === null) {
                throw new Error('MARK_SCORE_REQUIRED');
            }

            if (draft.supersedesMarkId) {
                await tx.assessmentAttemptMark.updateMany({
                    where: {
                        id: draft.supersedesMarkId,
                        attemptId,
                        status: 'SUBMITTED',
                    },
                    data: { status: 'SUPERSEDED' },
                });
            }

            return tx.assessmentAttemptMark.update({
                where: { id: draft.id },
                data: { status: 'SUBMITTED', submittedAt: new Date() },
            });
        });

        if (!mark) {
            return errorResponse(404, 'NOT_FOUND', 'Editable marking draft does not exist');
        }
        return jsonResponse({
            mark: {
                ...mark,
                score: mark.score?.toString() ?? null,
                outOf: mark.outOf.toString(),
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'MARK_SCORE_REQUIRED') {
            return errorResponse(400, 'VALIDATION_ERROR', 'Enter a score before submitting', {
                score: ['Enter a score before submitting'],
            });
        }
        return prismaError(error, 'Mark');
    }
}
