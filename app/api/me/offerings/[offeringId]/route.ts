import { NextRequest, NextResponse } from 'next/server';

import { getLearningOffering } from '@/components/navigation/learning/server';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { guardLearningRequest } from '../_guard';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/me/offerings/[offeringId]'>,
): Promise<NextResponse> {
    const guard = await guardLearningRequest(request, PERMISSION_CODE.OFFERING_VIEW);
    if (!guard.ok) return guard.response;

    const { offeringId } = await params;
    const offering = await getLearningOffering(
        guard.session.user.id,
        guard.access,
        offeringId,
        new Date(),
    );
    if (!offering) return errorResponse(404, 'NOT_FOUND', 'Offering not found');
    return jsonResponse({ offering });
}
