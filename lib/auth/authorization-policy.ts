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

export function authorizedFor(
    grantedPermissions: Iterable<PermissionCode>,
    requestedPermission: PermissionCode,
): boolean {
    return hasPermission(grantedPermissions, requestedPermission);
}
