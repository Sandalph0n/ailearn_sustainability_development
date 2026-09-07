import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import { guardToolApi } from '@/lib/tools/api-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
    const guard = await guardToolApi(request, 'replay:read');
    if (!guard.ok) return guard.response;

    const rawLimit = Number(request.nextUrl.searchParams.get('limit') ?? 50);
    const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
    const cursor = request.nextUrl.searchParams.get('cursor');
    if (cursor && !z.uuid().safeParse(cursor).success) {
        return errorResponse(400, 'VALIDATION_ERROR', 'cursor must be a work-session UUID');
    }

    const rows = await db.assignmentWorkSession.findMany({
        where: {
            assignmentWorkspaceId: guard.claims.assignmentWorkspaceId,
            toolId: guard.claims.toolId,
        },
        orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
        select: {
            id: true,
            startAt: true,
            endAt: true,
            toolVersion: { select: { id: true, version: true } },
            _count: { select: { eventBatches: true } },
            eventBatches: {
                orderBy: { seqEnd: 'desc' },
                take: 1,
                select: { seqEnd: true, receivedAt: true },
            },
        },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return jsonResponse({
        sessions: page.map((session) => ({
            id: session.id,
            startedAt: session.startAt.toISOString(),
            endedAt: session.endAt?.toISOString() ?? null,
            toolVersion: session.toolVersion,
            eventBatchCount: session._count.eventBatches,
            checkpoint: session.eventBatches[0]?.seqEnd ?? -1,
            lastReceivedAt: session.eventBatches[0]?.receivedAt.toISOString() ?? null,
            currentRuntimeCompatible: session.toolVersion?.id === guard.claims.toolVersionId,
        })),
        nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    });
}
