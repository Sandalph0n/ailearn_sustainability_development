import type { AuthorizedContextOption } from '../../../lib/context/context-params';
import {
    hasPermission,
    PERMISSION_CODE,
    type PermissionCode,
} from '../../../lib/auth/permissions';

export type LearningRoleSelector = {
    institutionId: string;
    roleId: string;
    offeringId?: string | null;
};

export type LearningAccess = {
    assignmentId: string;
    institution: { id: string; name: string };
    role: {
        id: string;
        roleName: string;
        scopeType: 'INSTITUTION' | 'OFFERING';
    };
    permissions: PermissionCode[];
    /** `null` means every offering in the institution; a Set means exactly those scopes. */
    offeringIds: ReadonlySet<string> | null;
};

function sameAssignment(
    context: AuthorizedContextOption,
    selected: AuthorizedContextOption,
): boolean {
    return context.assignmentId === selected.assignmentId;
}

/**
 * Resolve exactly the role requested by the URL. Unlike display context resolution, an invalid
 * selector never falls back to another role. One OFFERING assignment may contribute many context
 * rows, so all of its offering ids are folded into one access object.
 */
export function learningAccessForSelector(
    contexts: readonly AuthorizedContextOption[],
    selector: LearningRoleSelector,
): LearningAccess | null {
    const selected = contexts.find(
        (context) =>
            context.institution.id === selector.institutionId &&
            context.role.id === selector.roleId &&
            (!selector.offeringId || context.offering?.id === selector.offeringId),
    );
    if (!selected) return null;

    const assignmentContexts = contexts.filter((context) => sameAssignment(context, selected));
    const offeringIds =
        selected.role.scopeType === 'INSTITUTION'
            ? null
            : new Set(
                  assignmentContexts.flatMap((context) =>
                      context.offering ? [context.offering.id] : [],
                  ),
              );

    return {
        assignmentId: selected.assignmentId,
        institution: selected.institution,
        role: selected.role,
        permissions: selected.permissions,
        offeringIds,
    };
}

export function learningAccessWithPermission(
    contexts: readonly AuthorizedContextOption[],
    selector: LearningRoleSelector,
    permission: PermissionCode,
): LearningAccess | null {
    const access = learningAccessForSelector(contexts, selector);
    return access && hasPermission(access.permissions, permission) ? access : null;
}

export function firstLearningAccessWithPermission(
    contexts: readonly AuthorizedContextOption[],
    permission: PermissionCode,
): LearningAccess | null {
    for (const context of contexts) {
        if (!hasPermission(context.permissions, permission)) continue;
        return learningAccessForSelector(contexts, {
            institutionId: context.institution.id,
            roleId: context.role.id,
        });
    }
    return null;
}

export function accessCoversOffering(access: LearningAccess, offeringId: string): boolean {
    return access.offeringIds === null || access.offeringIds.has(offeringId);
}

/** Configuration-level assessment viewing is intentionally a superset of published viewing. */
export function canViewPublishedAssessments(access: LearningAccess): boolean {
    return hasPermission(access.permissions, PERMISSION_CODE.ASSESSMENT_VIEW_PUBLISHED);
}

export function canStartAttempts(access: LearningAccess): boolean {
    return hasPermission(access.permissions, PERMISSION_CODE.ASSESSMENT_ATTEMPT);
}

export function canViewOwnAttempts(access: LearningAccess): boolean {
    return hasPermission(access.permissions, PERMISSION_CODE.ATTEMPT_VIEW_OWN);
}

export function isPublishedAt(publishAt: Date | string | null, now: Date): boolean {
    return publishAt !== null && new Date(publishAt).getTime() <= now.getTime();
}

export type TermTiming = {
    year: number;
    periods: ReadonlyArray<{ startAt: Date | string; endAt: Date | string }>;
};

export type TermStatus = 'current' | 'upcoming' | 'past';

/** Date bounds win; year is a conservative fallback for imported terms without periods. */
export function termStatus(term: TermTiming, now: Date): TermStatus {
    const starts = term.periods.map((period) => new Date(period.startAt).getTime());
    const ends = term.periods.map((period) => new Date(period.endAt).getTime());

    if (starts.length > 0 && ends.length > 0) {
        const start = Math.min(...starts);
        const end = Math.max(...ends);
        if (now.getTime() < start) return 'upcoming';
        if (now.getTime() > end) return 'past';
        return 'current';
    }

    if (term.year < now.getFullYear()) return 'past';
    if (term.year > now.getFullYear()) return 'upcoming';
    return 'current';
}
