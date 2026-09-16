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
import { getCurrentSession, type AuthSession } from '@/lib/auth/session/service';
import { formatValidationErrors } from '@/lib/auth/validation/credentials';
import { CONTEXT_PARAM, type AuthorizedContextOption } from '@/lib/context/context-params';
import { db } from '@/lib/db';

type OfferingGuardSuccess = {
    ok: true;
    session: AuthSession;
    context: AuthorizedContextOption;
};

type OfferingGuardResult =
    | OfferingGuardSuccess
    | { ok: false; response: NextResponse };

/** Authorize a concrete offering loaded from PostgreSQL, never an offering id trusted from URL context. */
export async function guardOfferingAction(
    request: NextRequest,
    institutionId: string,
    offeringId: string,
    permission: PermissionCode,
): Promise<OfferingGuardResult> {
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
        { institutionId, roleId },
        { kind: 'OFFERING', institutionId, offeringId },
        permission,
    );
    if (!context) {
        return {
            ok: false,
            response: errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'This action is not allowed'),
        };
    }

    return { ok: true, session, context };
}

export async function guardOfferingWrite<TOutput>(
    request: NextRequest,
    institutionId: string,
    offeringId: string,
    permission: PermissionCode,
    schema: z.ZodType<TOutput>,
    entityName: string,
): Promise<(OfferingGuardSuccess & { data: TOutput }) | { ok: false; response: NextResponse }> {
    const guard = await guardOfferingAction(request, institutionId, offeringId, permission);
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
                `${entityName} data is invalid`,
                formatValidationErrors(parsed.error),
            ),
        };
    }

    return { ...guard, data: parsed.data };
}
