import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import { guardToolApi } from '@/lib/tools/api-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
    const guard = await guardToolApi(request, 'events:append');
    if (!guard.ok) return guard.response;

    const session = await db.assignmentWorkSession.findFirst({
        where: {
            id: guard.claims.workSessionId,
            assignmentWorkspaceId: guard.claims.assignmentWorkspaceId,
            toolId: guard.claims.toolId,
            toolVersionId: guard.claims.toolVersionId,
        },
        select: {
            endAt: true,
            eventBatches: { orderBy: { seqEnd: 'desc' }, take: 1, select: { seqEnd: true } },
        },
    });
    if (!session) return errorResponse(404, 'NOT_FOUND', 'Tool work session not found');

    const checkpoint = session.eventBatches[0]?.seqEnd ?? -1;
    return jsonResponse({
        checkpoint,
        nextSeq: checkpoint + 1,
        closed: session.endAt !== null,
    });
}
