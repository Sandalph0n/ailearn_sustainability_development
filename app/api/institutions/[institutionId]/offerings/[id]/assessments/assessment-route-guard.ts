import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';

import { authorizeTarget } from '@/lib/auth/authorization-service';
import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
} from '@/lib/auth/http/response';
import type { PermissionCode } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session/service';
import { formatValidationErrors } from '@/lib/auth/validation/credentials';
import { CONTEXT_PARAM, type AuthorizedContextOption } from '@/lib/context/context-params';
import { db } from '@/lib/db';

type AssessmentGuardSuccess = {
    ok: true;
    context: AuthorizedContextOption;
};

type AssessmentGuardResult =
    | AssessmentGuardSuccess
    | { ok: false; response: NextResponse };

/**
 * Authorize one assessment action against the offering resolved from PostgreSQL.
 *
 * Only the role selector comes from the query string, and it is matched against assignments the
 * signed-in user actually holds. The institution and offering target come from the route plus the
 * offering row itself, so a forged `?institution=` or `?offering=` cannot widen the boundary.
 */
export async function guardAssessmentAction(
    request: NextRequest,
    institutionId: string,
    offeringId: string,
    permission: PermissionCode,
): Promise<AssessmentGuardResult> {
    if (!isSameOriginRequest(request)) {
        return { ok: false, response: invalidOriginResponse() };
    }

    const session = await getCurrentSession();
    if (!session) {
        return {
            ok: false,
            response: errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue'),
        };
    }

    const offering = await db.offering.findUnique({
        where: { id: offeringId },
        select: { subject: { select: { institutionId: true } } },
    });
    if (!offering || offering.subject.institutionId !== institutionId) {
        return {
            ok: false,
            response: errorResponse(404, 'NOT_FOUND', 'Offering does not exist'),
        };
    }

    const roleId = request.nextUrl.searchParams.get(CONTEXT_PARAM.role);
    if (!roleId) {
        return {
            ok: false,
            response: errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'This action is not allowed'),
        };
    }

    const context = await authorizeTarget(
        session.user.id,
        { institutionId: offering.subject.institutionId, roleId },
        {
            kind: 'OFFERING',
            institutionId: offering.subject.institutionId,
            offeringId,
        },
        permission,
    );
    if (!context) {
        return {
            ok: false,
            response: errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'This action is not allowed'),
        };
    }

    return { ok: true, context };
}

export async function guardAssessmentWrite<TOutput>(
    request: NextRequest,
    institutionId: string,
    offeringId: string,
    permission: PermissionCode,
    schema: z.ZodType<TOutput>,
): Promise<
    | (AssessmentGuardSuccess & { data: TOutput })
    | { ok: false; response: NextResponse }
> {
    const guard = await guardAssessmentAction(
        request,
        institutionId,
        offeringId,
        permission,
    );
    if (!guard.ok) return guard;

    const body = await readAuthJson(request);
    if (!body.ok) {
        return { ok: false, response: invalidBodyResponse(body.reason) };
    }

    const parsed = schema.safeParse(body.value);
    if (!parsed.success) {
        return {
            ok: false,
            response: errorResponse(
                400,
                'VALIDATION_ERROR',
                'Assessment data is invalid',
                formatValidationErrors(parsed.error),
            ),
        };
    }

    return { ...guard, data: parsed.data };
}
