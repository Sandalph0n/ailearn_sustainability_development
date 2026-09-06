import { NextRequest, NextResponse } from 'next/server';

import { listLearningOfferings } from '@/components/navigation/learning/server';
import { jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { guardLearningRequest } from './_guard';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
    const guard = await guardLearningRequest(request, PERMISSION_CODE.OFFERING_VIEW);
    if (!guard.ok) return guard.response;

    const offerings = await listLearningOfferings(guard.access, new Date());
    return jsonResponse({ offerings });
}
