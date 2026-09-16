import { NextRequest, NextResponse } from 'next/server';

import { badId, prismaError } from '@/lib/admin/route-helpers';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { guardAttemptWrite } from '@/lib/marking/attempt-route-guard';
import { MarkDraftUpdateSchema } from '@/lib/marking/mark-schema';

export const runtime = 'nodejs';

/** Save a draft. Submitted marks are immutable; a correction starts a new draft revision. */
export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/attempts/[attemptId]/marks/[markId]'>,
): Promise<NextResponse> {
    const { institutionId, attemptId, markId } = await params;
    const invalid = badId(institutionId) ?? badId(attemptId) ?? badId(markId);
    if (invalid) return invalid;

    const guard = await guardAttemptWrite(
        request,
        institutionId,
        attemptId,
        PERMISSION_CODE.ATTEMPT_MARK,
        MarkDraftUpdateSchema,
    );
    if (!guard.ok) return guard.response;

    try {
        const current = await db.assessmentAttemptMark.findFirst({
            where: {
                id: markId,
                attemptId,
                markedById: guard.session.user.id,
                status: 'DRAFT',
            },
            select: { score: true, outOf: true },
        });
        if (!current) {
            return errorResponse(404, 'NOT_FOUND', 'Editable marking draft does not exist');
        }

        const score = guard.data.score === undefined
            ? current.score?.toNumber() ?? null
            : guard.data.score;
        const outOf = guard.data.outOf ?? current.outOf.toNumber();
        if (score !== null && score > outOf) {
            return errorResponse(400, 'VALIDATION_ERROR', 'Score cannot exceed the maximum mark', {
                score: ['Score cannot exceed the maximum mark'],
            });
        }

        const mark = await db.assessmentAttemptMark.update({
            where: { id: markId },
            data: guard.data,
        });
        return jsonResponse({
            mark: {
                ...mark,
                score: mark.score?.toString() ?? null,
                outOf: mark.outOf.toString(),
            },
        });
    } catch (error) {
        return prismaError(error, 'Mark');
    }
}
