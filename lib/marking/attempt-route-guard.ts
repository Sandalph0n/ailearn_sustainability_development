import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';

import { errorResponse, invalidBodyResponse } from '@/lib/auth/http/response';
import { readAuthJson } from '@/lib/auth/http/request';
import { guardOfferingAction } from '@/lib/auth/offering-route-guard';
import type { PermissionCode } from '@/lib/auth/permissions';
import type { AuthSession } from '@/lib/auth/session/service';
import { formatValidationErrors } from '@/lib/auth/validation/credentials';
import { db } from '@/lib/db';

type AttemptGuardSuccess = {
    ok: true;
    attempt: { id: string; offeringId: string };
    session: AuthSession;
};

export async function guardAttemptAction(
    request: NextRequest,
    institutionId: string,
    attemptId: string,
    permission: PermissionCode,
): Promise<AttemptGuardSuccess | { ok: false; response: NextResponse }> {
    const attempt = await db.assessmentAttempt.findUnique({
        where: { id: attemptId },
        select: {
            id: true,
            assessment: {
                select: {
                    offering: {
                        select: {
                            id: true,
                            subject: { select: { institutionId: true } },
                        },
                    },
                },
            },
        },
    });

    if (!attempt || attempt.assessment.offering.subject.institutionId !== institutionId) {
        return { ok: false, response: errorResponse(404, 'NOT_FOUND', 'Attempt does not exist') };
    }

    const access = await guardOfferingAction(
        request,
        institutionId,
        attempt.assessment.offering.id,
        permission,
    );
    if (!access.ok) return access;

    return {
        ok: true,
        attempt: { id: attempt.id, offeringId: attempt.assessment.offering.id },
        session: access.session,
    };
}

export async function guardAttemptWrite<TOutput>(
    request: NextRequest,
    institutionId: string,
    attemptId: string,
    permission: PermissionCode,
    schema: z.ZodType<TOutput>,
): Promise<
    | (AttemptGuardSuccess & { data: TOutput })
    | { ok: false; response: NextResponse }
> {
    const guard = await guardAttemptAction(request, institutionId, attemptId, permission);
    if (!guard.ok) return guard;

    const body = await readAuthJson(request);
    if (!body.ok) return { ok: false, response: invalidBodyResponse(body.reason) };

    const parsed = schema.safeParse(body.value);
    if (!parsed.success) {
        return {
            ok: false,
            response: errorResponse(
                400,
                'VALIDATION_ERROR',
                'Mark data is invalid',
                formatValidationErrors(parsed.error),
            ),
        };
    }

    return { ...guard, data: parsed.data };
}
