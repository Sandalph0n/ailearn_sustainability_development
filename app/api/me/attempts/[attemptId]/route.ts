import { NextRequest, NextResponse } from 'next/server';

import { getOwnAttempt } from '@/components/navigation/learning/server';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { guardLearningRequest } from '../../offerings/_guard';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/me/attempts/[attemptId]'>,
): Promise<NextResponse> {
    const guard = await guardLearningRequest(request, PERMISSION_CODE.OFFERING_VIEW);
    if (!guard.ok) return guard.response;

    const { attemptId } = await params;
    const result = await getOwnAttempt(
        guard.session.user.id,
        guard.access,
        attemptId,
        new Date(),
    );
    if (!result) return errorResponse(404, 'NOT_FOUND', 'Attempt not found');
    return jsonResponse(result);
}
