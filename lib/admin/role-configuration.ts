// File này giữ các luật nhiều bảng của Role; Zod chỉ kiểm được hình dạng từng trường.
import 'server-only';

import type { Prisma } from '@/app/generated/prisma/client';
import type { RoleSchemaValue } from '@/lib/admin/role-schema';

export class RoleConfigurationError extends Error {
    constructor(
        message: string,
        readonly field: 'institutionId' | 'scopeType' | 'includedRoleIds' | 'permissionIds',
    ) {
        super(message);
    }
}

/**
 * Kiểm các khoá ngoại có cùng ngữ cảnh và chặn chu trình trước khi chạm trigger database.
 * Trigger vẫn là chốt cuối để đóng cả ca hai request ghi cạnh đối nghịch cùng lúc.
 */
export async function validateRoleConfiguration(
    tx: Prisma.TransactionClient,
    data: RoleSchemaValue,
    currentRoleId: string | null,
): Promise<void> {
    const institution = await tx.institution.findUnique({
        where: { id: data.institutionId },
        select: { id: true },
    });
    if (!institution) {
        throw new RoleConfigurationError('Institution does not exist', 'institutionId');
    }

    if (currentRoleId) {
        const current = await tx.role.findUnique({
            where: { id: currentRoleId },
            select: {
                institutionId: true,
                scopeType: true,
                _count: { select: { roleAssignments: true, roleRequests: true } },
            },
        });
        if (!current) throw new RoleConfigurationError('Role does not exist', 'includedRoleIds');
        if (current.institutionId !== data.institutionId) {
            throw new RoleConfigurationError(
                'A role cannot be moved to another institution',
                'institutionId',
            );
        }
        if (
            current.scopeType !== data.scopeType &&
            current._count.roleAssignments + current._count.roleRequests > 0
        ) {
            throw new RoleConfigurationError(
                'A role with assignment or request history cannot change scope',
                'scopeType',
            );
        }
        if (data.includedRoleIds.includes(currentRoleId)) {
            throw new RoleConfigurationError('A role cannot include itself', 'includedRoleIds');
        }
    }

    const [includedRoles, permissions] = await Promise.all([
        tx.role.findMany({
            where: { id: { in: data.includedRoleIds } },
            select: { id: true, institutionId: true },
        }),
        tx.permission.findMany({
            where: { id: { in: data.permissionIds } },
            select: { id: true },
        }),
    ]);

    if (
        includedRoles.length !== data.includedRoleIds.length ||
        includedRoles.some((role) => role.institutionId !== data.institutionId)
    ) {
        throw new RoleConfigurationError(
            'Included roles must belong to this institution',
            'includedRoleIds',
        );
    }

    if (permissions.length !== data.permissionIds.length) {
        throw new RoleConfigurationError('One or more permissions do not exist', 'permissionIds');
    }

    if (!currentRoleId || data.includedRoleIds.length === 0) return;

    const edges = await tx.roleInclusion.findMany({
        where: { includingRole: { institutionId: data.institutionId } },
        select: { includingRoleId: true, includedRoleId: true },
    });

    const graph = new Map<string, string[]>();
    for (const edge of edges) {
        if (edge.includingRoleId === currentRoleId) continue;
        const children = graph.get(edge.includingRoleId) ?? [];
        children.push(edge.includedRoleId);
        graph.set(edge.includingRoleId, children);
    }
    graph.set(currentRoleId, data.includedRoleIds);

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const hasCycle = (roleId: string): boolean => {
        if (visiting.has(roleId)) return true;
        if (visited.has(roleId)) return false;

        visiting.add(roleId);
        for (const childId of graph.get(roleId) ?? []) {
            if (hasCycle(childId)) return true;
        }
        visiting.delete(roleId);
        visited.add(roleId);
        return false;
    };

    for (const roleId of graph.keys()) {
        if (hasCycle(roleId)) {
            throw new RoleConfigurationError(
                'These included roles would create a permission cycle',
                'includedRoleIds',
            );
        }
    }
}

/** Đồng bộ quyền nhưng giữ lịch sử grantedAt/revokedAt. */
export async function syncRolePermissions(
    tx: Prisma.TransactionClient,
    roleId: string,
    permissionIds: string[],
): Promise<void> {
    const existing = await tx.rolePermission.findMany({
        where: { roleId, revokedAt: null },
        select: { permissionId: true },
    });
    const now = new Date();

    await tx.rolePermission.updateMany({
        where: { roleId, revokedAt: null, permissionId: { notIn: permissionIds } },
        data: { revokedAt: now },
    });

    const active = new Set(existing.map((row) => row.permissionId));
    const toGrant = permissionIds.filter((permissionId) => !active.has(permissionId));

    if (toGrant.length > 0) {
        await tx.rolePermission.createMany({
            data: toGrant.map((permissionId) => ({ roleId, permissionId, grantedAt: now })),
        });
    }
}
