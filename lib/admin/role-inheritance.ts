import { effectiveRoleIds } from '../auth/role-request-policy';

export type RolePermissionNode = {
    id: string;
    includedRoleIds: readonly string[];
    directPermissionIds: readonly string[];
};

/** Resolve permission IDs contributed by every role's complete inclusion graph. */
export function effectivePermissionIdsByRole(
    roles: readonly RolePermissionNode[],
): Map<string, string[]> {
    const edges = roles.flatMap((role) =>
        role.includedRoleIds.map((includedRoleId) => ({
            includingRoleId: role.id,
            includedRoleId,
        })),
    );
    const directByRole = new Map(
        roles.map((role) => [role.id, role.directPermissionIds] as const),
    );
    const result = new Map<string, string[]>();

    for (const role of roles) {
        const permissions = new Set<string>();
        for (const effectiveRoleId of effectiveRoleIds([role.id], edges)) {
            for (const permissionId of directByRole.get(effectiveRoleId) ?? []) {
                permissions.add(permissionId);
            }
        }
        result.set(role.id, [...permissions].sort());
    }

    return result;
}
