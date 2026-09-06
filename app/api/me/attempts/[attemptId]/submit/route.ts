import { NextRequest, NextResponse } from 'next/server';

import { getOwnAttempt } from '@/components/navigation/learning/server';
import { canStartAttempts } from '@/components/navigation/learning/policy';
import { isSameOriginRequest } from '@/lib/auth/http/request';
import { errorResponse, invalidOriginResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { guardLearningRequest } from '../../../offerings/_guard';

export const runtime = 'nodejs';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/me/attempts/[attemptId]/submit'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();

    const guard = await guardLearningRequest(request, PERMISSION_CODE.OFFERING_VIEW);
    if (!guard.ok) return guard.response;
    if (!canStartAttempts(guard.access)) {
        return errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'This role cannot submit attempts');
    }

    const { attemptId } = await params;
    const existing = await getOwnAttempt(
        guard.session.user.id,
        guard.access,
        attemptId,
        new Date(),
    );
    if (!existing) return errorResponse(404, 'NOT_FOUND', 'Attempt not found');
    if (existing.attempt.submitAt) {
        return errorResponse(409, 'RESOURCE_IN_USE', 'This attempt has already been submitted');
    }

    const submitAt = new Date();
    const updated = await db.assessmentAttempt.updateMany({
        where: { id: attemptId, userId: guard.session.user.id, submitAt: null },
        data: { submitAt },
    });
    if (updated.count !== 1) {
        return errorResponse(409, 'RESOURCE_IN_USE', 'This attempt has already been submitted');
    }

    return jsonResponse({ attempt: { id: attemptId, submitAt: submitAt.toISOString() } });
}
