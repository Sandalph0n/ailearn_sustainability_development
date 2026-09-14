import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import { MAX_REPLAY_BATCHES_PER_PAGE } from '@/lib/tools/api-contract';
import { guardToolApi } from '@/lib/tools/api-auth';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/tool/v1/replay/sessions/[sessionId]/events'>,
): Promise<NextResponse> {
    const guard = await guardToolApi(request, 'replay:read');
    if (!guard.ok) return guard.response;
    const { sessionId } = await params;
    if (!z.uuid().safeParse(sessionId).success) {
        return errorResponse(404, 'NOT_FOUND', 'Replay session not found');
    }

    const target = await db.assignmentWorkSession.findFirst({
        where: {
            id: sessionId,
            assignmentWorkspaceId: guard.claims.assignmentWorkspaceId,
            toolId: guard.claims.toolId,
        },
        select: { toolVersionId: true },
    });
    if (!target) return errorResponse(404, 'NOT_FOUND', 'Replay session not found');
    if (target.toolVersionId !== guard.claims.toolVersionId) {
        return errorResponse(
            409,
            'TOOL_VERSION_MISMATCH',
            'Replay must run with the tool version that recorded the session',
            undefined,
            { requiredToolVersionId: target.toolVersionId },
        );
    }

    const rawAfterSeq = Number(request.nextUrl.searchParams.get('afterSeq') ?? -1);
    const afterSeq = Number.isInteger(rawAfterSeq) && rawAfterSeq >= -1 ? rawAfterSeq : -1;
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') ?? 100);
    const limit = Number.isInteger(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), MAX_REPLAY_BATCHES_PER_PAGE)
        : 100;
    const rows = await db.eventBatch.findMany({
        where: { assignmentWorkSessionId: sessionId, seqStart: { gt: afterSeq } },
        orderBy: { seqStart: 'asc' },
        take: limit + 1,
        select: {
            id: true,
            clientBatchId: true,
            seqStart: true,
            seqEnd: true,
            clientAt: true,
            receivedAt: true,
            events: true,
            payloadHash: true,
            previousChainHash: true,
            chainHash: true,
        },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return jsonResponse({
        batches: page.map((batch) => ({
            ...batch,
            clientAt: batch.clientAt.toISOString(),
            receivedAt: batch.receivedAt.toISOString(),
        })),
        nextAfterSeq: hasMore ? page.at(-1)?.seqEnd ?? null : null,
    });
}
