import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
    getPublishedAssessment,
    listOwnAttempts,
} from '@/components/navigation/learning/server';
import {
    canStartAttempts,
    canViewOwnAttempts,
} from '@/components/navigation/learning/policy';
import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
    jsonResponse,
} from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { formatValidationErrors } from '@/lib/auth/validation/credentials';
import { db } from '@/lib/db';
import { guardLearningRequest } from '../offerings/_guard';

export const runtime = 'nodejs';

const startAttemptSchema = z.strictObject({
    assessmentId: z.uuid({ message: 'Choose a valid assessment' }),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
    const guard = await guardLearningRequest(request, PERMISSION_CODE.OFFERING_VIEW);
    if (!guard.ok) return guard.response;

    const assessmentId = request.nextUrl.searchParams.get('assessmentId');
    if (!assessmentId) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Choose an assessment');
    }

    const attempts = await listOwnAttempts(
        guard.session.user.id,
        guard.access,
        assessmentId,
        new Date(),
    );
    if (!attempts) return errorResponse(404, 'NOT_FOUND', 'Assessment not found');
    return jsonResponse({ attempts });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();

    const guard = await guardLearningRequest(request, PERMISSION_CODE.OFFERING_VIEW);
    if (!guard.ok) return guard.response;
    if (!canStartAttempts(guard.access) || !canViewOwnAttempts(guard.access)) {
        return errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'This role cannot start attempts');
    }

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = startAttemptSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Attempt data is invalid',
            formatValidationErrors(parsed.error),
        );
    }

    const assessment = await getPublishedAssessment(
        guard.access,
        parsed.data.assessmentId,
        new Date(),
    );
    if (!assessment) return errorResponse(404, 'NOT_FOUND', 'Assessment not found');
    if (assessment.isGroup) {
        return errorResponse(
            409,
            'RESOURCE_IN_USE',
            'Group attempts are not supported yet. An individual attempt was not created.',
        );
    }

    try {
        const attempt = await db.$transaction(async (tx) => {
            const createdAttempt = await tx.assessmentAttempt.create({
                data: {
                    userId: guard.session.user.id,
                    assessmentId: assessment.id,
                },
                select: { id: true, startAt: true },
            });
            const workspace = await tx.workspace.create({
                data: {
                    name: `${assessment.offering.subject.code} · ${assessment.name}`,
                    lastOpenedAt: createdAttempt.startAt,
                },
                select: { id: true },
            });
            await tx.assignmentWorkspace.create({
                data: { attemptId: createdAttempt.id, workspaceId: workspace.id },
            });
            return { ...createdAttempt, workspaceId: workspace.id };
        });

        return jsonResponse(
            {
                attempt: {
                    ...attempt,
                    startAt: attempt.startAt.toISOString(),
                },
            },
            { status: 201 },
        );
    } catch (error) {
        console.error('Failed to start assessment attempt', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to start assessment attempt');
    }
}
