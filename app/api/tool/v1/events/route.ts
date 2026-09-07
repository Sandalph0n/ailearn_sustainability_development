import { isDeepStrictEqual } from 'node:util';

import { NextRequest, NextResponse } from 'next/server';

import { Prisma } from '@/app/generated/prisma/client';
import { errorResponse, invalidBodyResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import { MAX_EVENT_BATCH_BYTES, ToolEventBatchSchema } from '@/lib/tools/api-contract';
import { guardToolApi, guardToolWrite } from '@/lib/tools/api-auth';
import { readToolJson } from '@/lib/tools/api-request';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = await guardToolApi(request, 'events:append');
    if (!guard.ok) return guard.response;
    const writeError = guardToolWrite(guard.claims);
    if (writeError) return writeError;

    const body = await readToolJson(request, MAX_EVENT_BATCH_BYTES);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = ToolEventBatchSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Event batch data is invalid');
    }

    const result = await db.$transaction(async (tx) => {
        // Serialize append decisions per work session. Otherwise two concurrent valid requests can
        // both observe the same checkpoint and create overlapping sequence ranges.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${guard.claims.workSessionId}, 0))`;

        const session = await tx.assignmentWorkSession.findFirst({
            where: {
                id: guard.claims.workSessionId,
                assignmentWorkspaceId: guard.claims.assignmentWorkspaceId,
                toolId: guard.claims.toolId,
                toolVersionId: guard.claims.toolVersionId,
                endAt: null,
            },
            select: { id: true },
        });
        if (!session) return { kind: 'missing' as const };

        const duplicate = await tx.eventBatch.findUnique({
            where: {
                assignmentWorkSessionId_clientBatchId: {
                    assignmentWorkSessionId: session.id,
                    clientBatchId: parsed.data.batchId,
                },
            },
            select: {
                id: true,
                seqStart: true,
                seqEnd: true,
                clientAt: true,
                receivedAt: true,
                events: true,
            },
        });
        if (duplicate) {
            const identical =
                duplicate.seqStart === parsed.data.seqStart &&
                duplicate.seqEnd === parsed.data.seqEnd &&
                duplicate.clientAt.getTime() === new Date(parsed.data.clientAt).getTime() &&
                isDeepStrictEqual(duplicate.events, parsed.data.events);
            return identical
                ? { kind: 'duplicate' as const, batch: duplicate }
                : { kind: 'idempotency' as const };
        }

        const checkpoint = await tx.eventBatch.aggregate({
            where: { assignmentWorkSessionId: session.id },
            _max: { seqEnd: true },
        });
        const expectedSeqStart = (checkpoint._max.seqEnd ?? -1) + 1;
        if (parsed.data.seqStart !== expectedSeqStart) {
            return { kind: 'sequence' as const, expectedSeqStart };
        }

        const batch = await tx.eventBatch.create({
            data: {
                assignmentWorkSessionId: session.id,
                clientBatchId: parsed.data.batchId,
                seqStart: parsed.data.seqStart,
                seqEnd: parsed.data.seqEnd,
                clientAt: new Date(parsed.data.clientAt),
                events: parsed.data.events as Prisma.InputJsonValue,
            },
            select: { id: true, seqStart: true, seqEnd: true, receivedAt: true },
        });
        return { kind: 'created' as const, batch };
    });

    if (result.kind === 'missing') {
        return errorResponse(409, 'RESOURCE_IN_USE', 'The work session is closed or unavailable');
    }
    if (result.kind === 'sequence') {
        return errorResponse(
            409,
            'EVENT_SEQUENCE_CONFLICT',
            'The event sequence does not continue from the server checkpoint',
            undefined,
            { expectedSeqStart: result.expectedSeqStart },
        );
    }
    if (result.kind === 'idempotency') {
        return errorResponse(
            409,
            'IDEMPOTENCY_CONFLICT',
            'This batchId was already used for a different event batch',
        );
    }

    return jsonResponse(
        {
            accepted: true,
            duplicate: result.kind === 'duplicate',
            checkpoint: result.batch.seqEnd,
            batch: {
                id: result.batch.id,
                seqStart: result.batch.seqStart,
                seqEnd: result.batch.seqEnd,
                receivedAt: result.batch.receivedAt.toISOString(),
            },
        },
        { status: result.kind === 'created' ? 201 : 200 },
    );
}
