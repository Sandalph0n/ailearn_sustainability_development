import 'server-only';

import type { Prisma } from '@/app/generated/prisma/client';
import {
    effectivePermissionCodes,
    type RolePermissionGrant,
} from '@/lib/auth/authorization-policy';
import {
    hasPermission,
    type PermissionCode,
} from '@/lib/auth/permissions';

type DelegationClient = Pick<
    Prisma.TransactionClient,
    | '$executeRaw'
    | 'role'
    | 'roleAssignment'
    | 'roleInclusion'
    | 'rolePermission'
    | 'permission'
>;

export class DelegationPolicyError extends Error {}

export const CHIEF_MANAGEMENT_ROLE_CODE = 'institution:chief.management';

/** A protected Chief role may only be granted or revoked by another active Chief. */
export async function assertCanManageProtectedRole(
    client: DelegationClient,
    institutionId: string,
    targetRoleId: string,
    actorUserId: string,
): Promise<void> {
    const target = await client.role.findFirst({
        where: { id: targetRoleId, institutionId },
        select: { roleCode: true },
    });
    if (!target || target.roleCode !== CHIEF_MANAGEMENT_ROLE_CODE) return;

    const actorIsChief = await client.roleAssignment.findFirst({
        where: {
            userId: actorUserId,
            roleRevokedAt: null,
            role: { institutionId, roleCode: CHIEF_MANAGEMENT_ROLE_CODE },
        },
        select: { id: true },
    });
    if (!actorIsChief) {
        throw new DelegationPolicyError(
            'Only another active Chief Management holder can change this protected role',
        );
    }
}

/** Keep at least one active Chief whenever the institution currently has one. */
export async function assertNotLastActiveChiefAssignment(
    client: DelegationClient,
    institutionId: string,
    assignmentId: string,
): Promise<void> {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`chief-role:${institutionId}`}, 0))`;
    const assignment = await client.roleAssignment.findFirst({
        where: { id: assignmentId, roleRevokedAt: null, role: { institutionId } },
        select: { role: { select: { roleCode: true } } },
    });
    if (assignment?.role.roleCode !== CHIEF_MANAGEMENT_ROLE_CODE) return;

    const activeChiefs = await client.roleAssignment.count({
        where: {
            roleRevokedAt: null,
            role: { institutionId, roleCode: CHIEF_MANAGEMENT_ROLE_CODE },
        },
    });
    if (activeChiefs <= 1) {
        throw new DelegationPolicyError(
            'The last active Chief Management assignment cannot be revoked',
        );
    }
}

/**
 * A role may only delegate capabilities it already holds. `hasPermission` deliberately handles
 * manage bundles in both directions, so a manager may delegate an individual action and an actor
 * holding every individual action may delegate the equivalent manage bundle.
 */
export function permissionsOutsideDelegateAuthority(
    actorPermissions: readonly PermissionCode[],
    targetPermissions: readonly PermissionCode[],
): PermissionCode[] {
    return targetPermissions.filter(
        (permission) => !hasPermission(actorPermissions, permission),
    );
}

async function institutionPermissionGraph(client: DelegationClient, institutionId: string) {
    const [inclusions, grants] = await Promise.all([
        client.roleInclusion.findMany({
            where: { includingRole: { institutionId } },
            select: { includingRoleId: true, includedRoleId: true },
        }),
        client.rolePermission.findMany({
            where: { role: { institutionId }, revokedAt: null },
            select: { roleId: true, permission: { select: { permission: true } } },
        }),
    ]);

    return {
        inclusions,
        grants: grants.map(
            (grant): RolePermissionGrant => ({
                roleId: grant.roleId,
                permission: grant.permission.permission,
            }),
        ),
    };
}

export async function assertCanDelegateRole(
    client: DelegationClient,
    institutionId: string,
    roleId: string,
    actorPermissions: readonly PermissionCode[],
): Promise<void> {
    const role = await client.role.findFirst({
        where: { id: roleId, institutionId },
        select: { id: true },
    });
    if (!role) throw new DelegationPolicyError('Role belongs to another institution');

    const graph = await institutionPermissionGraph(client, institutionId);
    const targetPermissions = effectivePermissionCodes(role.id, graph.inclusions, graph.grants);
    const outside = permissionsOutsideDelegateAuthority(actorPermissions, targetPermissions);

    if (outside.length > 0) {
        throw new DelegationPolicyError(
            'You cannot grant or change a role with permissions you do not hold',
        );
    }
}

/** Check the effective permissions of a proposed role definition before it is persisted. */
export async function assertCanDefineRole(
    client: DelegationClient,
    institutionId: string,
    permissionIds: readonly string[],
    includedRoleIds: readonly string[],
    actorPermissions: readonly PermissionCode[],
): Promise<void> {
    const [graph, directPermissions] = await Promise.all([
        institutionPermissionGraph(client, institutionId),
        client.permission.findMany({
            where: { id: { in: [...permissionIds] } },
            select: { permission: true },
        }),
    ]);
    const proposedRoleId = 'proposed-role';
    const targetPermissions = effectivePermissionCodes(
        proposedRoleId,
        [
            ...graph.inclusions,
            ...includedRoleIds.map((includedRoleId) => ({
                includingRoleId: proposedRoleId,
                includedRoleId,
            })),
        ],
        [
            ...graph.grants,
            ...directPermissions.map(
                (permission): RolePermissionGrant => ({
                    roleId: proposedRoleId,
                    permission: permission.permission,
                }),
            ),
        ],
    );
    const outside = permissionsOutsideDelegateAuthority(actorPermissions, targetPermissions);

    if (outside.length > 0) {
        throw new DelegationPolicyError(
            'You cannot define a role with permissions you do not hold',
        );
    }
}
