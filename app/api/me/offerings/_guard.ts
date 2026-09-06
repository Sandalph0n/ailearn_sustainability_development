import type { NextRequest, NextResponse } from 'next/server';

import { resolveLearningAccess, selectorFromUrl } from '@/components/navigation/learning/server';
import type { LearningAccess } from '@/components/navigation/learning/policy';
import { errorResponse } from '@/lib/auth/http/response';
import type { PermissionCode } from '@/lib/auth/permissions';
import { getCurrentSession, type AuthSession } from '@/lib/auth/session/service';

type LearningGuardResult =
    | { ok: true; session: AuthSession; access: LearningAccess }
    | { ok: false; response: NextResponse };

/** API calls always require an exact URL context and never inherit the page fallback. */
export async function guardLearningRequest(
    request: NextRequest,
    permission?: PermissionCode,
): Promise<LearningGuardResult> {
    const session = await getCurrentSession();
    if (!session) {
        return {
            ok: false,
            response: errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue'),
        };
    }

    const selector = selectorFromUrl(request.nextUrl);
    if (!selector) {
        return {
            ok: false,
            response: errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'Choose an active learning role'),
        };
    }

    const access = await resolveLearningAccess(session.user.id, selector, permission);
    if (!access) {
        return {
            ok: false,
            response: errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'This learning context is not allowed'),
        };
    }

    return { ok: true, session, access };
}
