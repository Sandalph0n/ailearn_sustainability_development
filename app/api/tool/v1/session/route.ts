import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import { guardToolApi } from '@/lib/tools/api-auth';

export const runtime = 'nodejs';

/** Close is idempotent so pagehide retries are harmless. */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
    const guard = await guardToolApi(request);
    if (!guard.ok) return guard.response;
    if (guard.claims.mode !== 'OWNER') {
        return errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'Replay sessions cannot be closed');
    }

    const current = await db.assignmentWorkSession.findFirst({
        where: {
            id: guard.claims.workSessionId,
            assignmentWorkspaceId: guard.claims.assignmentWorkspaceId,
            toolId: guard.claims.toolId,
            toolVersionId: guard.claims.toolVersionId,
        },
        select: { endAt: true },
    });
    if (!current) return errorResponse(404, 'NOT_FOUND', 'Tool work session not found');

    const endAt = current.endAt ?? new Date();
    if (!current.endAt) {
        await db.assignmentWorkSession.update({
            where: { id: guard.claims.workSessionId },
            data: { endAt },
        });
    }
    return jsonResponse({ session: { id: guard.claims.workSessionId, endAt: endAt.toISOString() } });
}
