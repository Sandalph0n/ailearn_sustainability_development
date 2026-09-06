import { NextRequest, NextResponse } from 'next/server';

import { getPublishedAssessment } from '@/components/navigation/learning/server';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { guardLearningRequest } from '../../offerings/_guard';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/me/assessments/[assessmentId]'>,
): Promise<NextResponse> {
    const guard = await guardLearningRequest(request, PERMISSION_CODE.OFFERING_VIEW);
    if (!guard.ok) return guard.response;

    const { assessmentId } = await params;
    const assessment = await getPublishedAssessment(guard.access, assessmentId, new Date());
    if (!assessment) return errorResponse(404, 'NOT_FOUND', 'Assessment not found');
    return jsonResponse({ assessment });
}
