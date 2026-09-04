import type { ContextOption } from '../context/context-params';
import {
    assertPermissionCode,
    hasPermission,
    type PermissionCode,
} from './permissions';
import {
    effectiveRoleIds,
    type RoleInclusionEdge,
} from './role-request-policy';

export type RolePermissionGrant = {
    roleId: string;
    permission: string;
};

/** Resolve direct and inherited permissions for one active role. */
export function effectivePermissionCodes(
    roleId: string,
    inclusions: readonly RoleInclusionEdge[],
    grants: readonly RolePermissionGrant[],
): PermissionCode[] {
    const effectiveRoles = effectiveRoleIds([roleId], inclusions);
    const permissions = new Set<PermissionCode>();

    for (const grant of grants) {
        if (!effectiveRoles.has(grant.roleId)) continue;
        assertPermissionCode(grant.permission);
        permissions.add(grant.permission);
    }

    return [...permissions].sort();
}

export type ContextSelector = {
    institutionId: string;
    roleId: string;
    offeringId: string | null;
};

export type RoleSelector = Omit<ContextSelector, 'offeringId'>;

export type AuthorizationTarget =
    | { kind: 'INSTITUTION'; institutionId: string }
    | { kind: 'OFFERING'; institutionId: string; offeringId: string };

/** API authorization is strict: an invalid URL context never falls back to another role. */
export function findSelectedContext<TContext extends ContextOption>(
    contexts: readonly TContext[],
    selector: ContextSelector,
): TContext | null {
    return (
        contexts.find(
            (context) =>
                context.institution.id === selector.institutionId &&
                context.role.id === selector.roleId &&
                (context.offering?.id ?? null) === selector.offeringId,
        ) ?? null
    );
}

/**
 * Match a role to the resource being acted on.
 *
 * An institution role covers its institution and every offering below it. An offering role never
 * covers an institution-level resource and only covers offerings explicitly attached to its
 * RoleAssignment. The permission itself deliberately carries no scope metadata.
 */
export function findContextForTarget<TContext extends ContextOption>(
    contexts: readonly TContext[],
    selector: RoleSelector,
    target: AuthorizationTarget,
): TContext | null {
    if (selector.institutionId !== target.institutionId) return null;

    return (
        contexts.find((context) => {
            if (
                context.institution.id !== selector.institutionId ||
                context.role.id !== selector.roleId
            ) {
                return false;
            }

            if (context.role.scopeType === 'INSTITUTION') return true;
            return target.kind === 'OFFERING' && context.offering?.id === target.offeringId;
        }) ?? null
    );
}

export function authorizedFor(
    grantedPermissions: Iterable<PermissionCode>,
    requestedPermission: PermissionCode,
): boolean {
    return hasPermission(grantedPermissions, requestedPermission);
}
