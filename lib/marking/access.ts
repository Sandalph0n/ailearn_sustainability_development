import 'server-only';

import { redirect } from 'next/navigation';

import type { Prisma } from '@/app/generated/prisma/client';
import { listAuthorizedContextOptions } from '@/lib/auth/authorization-service';
import {
    hasAnyPermission,
    hasPermission,
    MARKING_REPLAY_PERMISSION_CODES,
    PERMISSION_CODE,
} from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session/service';
import { CONTEXT_PARAM, type AuthorizedContextOption } from '@/lib/context/context-params';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export type MarkingCapabilities = {
    canViewAssessment: boolean;
    canViewAttempt: boolean;
    canReplay: boolean;
    canMark: boolean;
};

export type MarkingAccess = {
    userId: string;
    active: AuthorizedContextOption;
    roleContexts: AuthorizedContextOption[];
    capabilities: MarkingCapabilities;
};

/**
 * Resolve the selected role without pinning an offering-scoped assignment to one offering.
 * Resource queries below still constrain every offering to the assignment's active scopes.
 */
export async function requireMarkingAccess(query: SearchParams): Promise<MarkingAccess> {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const contexts = await listAuthorizedContextOptions(session.user.id);
    const wantedInstitution = first(query[CONTEXT_PARAM.institution]);
    const wantedRole = first(query[CONTEXT_PARAM.role]);
    const suppliedContext = Boolean(wantedInstitution || wantedRole);

    const active =
        wantedInstitution && wantedRole
            ? contexts.find(
                  (context) =>
                      context.institution.id === wantedInstitution &&
                      context.role.id === wantedRole &&
                      hasAnyPermission(context.permissions, MARKING_REPLAY_PERMISSION_CODES),
              )
            : suppliedContext
              ? undefined
              : contexts.find((context) =>
                    hasAnyPermission(context.permissions, MARKING_REPLAY_PERMISSION_CODES),
                );

    if (!active) redirect('/navigation/dashboard');

    const roleContexts = contexts.filter(
        (context) => context.assignmentId === active.assignmentId,
    );

    return {
        userId: session.user.id,
        active,
        roleContexts,
        capabilities: {
            canViewAssessment: hasPermission(
                active.permissions,
                PERMISSION_CODE.ASSESSMENT_VIEW,
            ),
            canViewAttempt: hasPermission(
                active.permissions,
                PERMISSION_CODE.ATTEMPT_VIEW_ALL,
            ),
            canReplay: hasPermission(
                active.permissions,
                PERMISSION_CODE.TOOL_SESSION_REPLAY_ALL,
            ),
            canMark: hasPermission(active.permissions, PERMISSION_CODE.ATTEMPT_MARK),
        },
    };
}

/** The exact offering boundary covered by the selected role assignment. */
export function markingOfferingWhere(access: MarkingAccess): Prisma.OfferingWhereInput {
    if (access.active.role.scopeType === 'INSTITUTION') {
        return { subject: { institutionId: access.active.institution.id } };
    }

    const offeringIds = access.roleContexts.flatMap((context) =>
        context.offering ? [context.offering.id] : [],
    );
    return { id: { in: offeringIds } };
}

export function markingContextQuery(access: MarkingAccess): string {
    return new URLSearchParams({
        [CONTEXT_PARAM.institution]: access.active.institution.id,
        [CONTEXT_PARAM.role]: access.active.role.id,
    }).toString();
}
