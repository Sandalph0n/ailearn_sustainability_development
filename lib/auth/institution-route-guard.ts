import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';

import { authorizeContext } from '@/lib/auth/authorization-service';
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

type InstitutionGuardSuccess = {
    ok: true;
    session: AuthSession;
    context: AuthorizedContextOption;
};

type InstitutionGuardResult =
    | InstitutionGuardSuccess
    | { ok: false; response: NextResponse };

/** Authorize one exact URL context; API calls never fall back to another role. */
export async function guardInstitutionAction(
    request: NextRequest,
    institutionId: string,
    permission: PermissionCode,
): Promise<InstitutionGuardResult> {
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

    const selectedInstitution = request.nextUrl.searchParams.get(CONTEXT_PARAM.institution);
    const roleId = request.nextUrl.searchParams.get(CONTEXT_PARAM.role);
    const offeringId = request.nextUrl.searchParams.get(CONTEXT_PARAM.offering);

    if (selectedInstitution !== institutionId || !roleId) {
        return {
            ok: false,
            response: errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'This context is not allowed'),
        };
    }

    const context = await authorizeContext(
        session.user.id,
        { institutionId, roleId, offeringId },
        permission,
    );

    // Institution-level resources must be changed under an institution role, never by borrowing
    // an offering-scoped role that happens to belong to the same institution.
    if (!context || context.role.scopeType !== 'INSTITUTION') {
        return {
            ok: false,
            response: errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'This action is not allowed'),
        };
    }

    return { ok: true, session, context };
}

export async function guardInstitutionWrite<TOutput>(
    request: NextRequest,
    institutionId: string,
    permission: PermissionCode,
    schema: z.ZodType<TOutput>,
    entityName: string,
): Promise<
    | (InstitutionGuardSuccess & { data: TOutput })
    | { ok: false; response: NextResponse }
> {
    const guard = await guardInstitutionAction(request, institutionId, permission);
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
                `${entityName} data is invalid`,
                formatValidationErrors(parsed.error),
            ),
        };
    }

    return { ...guard, data: parsed.data };
}
