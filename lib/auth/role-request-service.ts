import 'server-only';

import type { Prisma } from '@/app/generated/prisma/client';
import { canRequestRole, effectiveRoleIds } from '@/lib/auth/role-request-policy';

type RoleRequestClient = Pick<
    Prisma.TransactionClient,
    'role' | 'roleAssignment' | 'roleInclusion' | 'roleRequest'
>;

export type RequestableRoleOption = {
    id: string;
    roleName: string;
    scopeType: 'INSTITUTION' | 'OFFERING';
    pending: boolean;
};

/**
 * Trả về mọi role của institution mà user được phép NHÌN THẤY trong màn hình request.
 * Role OFFERING được xin ở đây như một role identity; offering cụ thể được gắn sau khi duyệt.
 * Quyền tạo request vẫn được kiểm lại trong transaction ở route POST.
 */
export async function listRequestableRoleOptions(
    client: RoleRequestClient,
    userId: string,
    institutionId: string,
): Promise<RequestableRoleOption[]> {
    const [roles, assignments, inclusions, pendingRequests] = await Promise.all([
        client.role.findMany({
            where: { institutionId },
            orderBy: [{ roleName: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                roleName: true,
                scopeType: true,
                requestMode: true,
                requestVisibilityRules: { select: { requiredRoleId: true } },
            },
        }),
        client.roleAssignment.findMany({
            where: {
                userId,
                roleRevokedAt: null,
                role: { institutionId },
            },
            select: { roleId: true },
        }),
        client.roleInclusion.findMany({
            where: { includingRole: { institutionId } },
            select: { includingRoleId: true, includedRoleId: true },
        }),
        client.roleRequest.findMany({
            where: { userId, institutionId, status: 'PENDING' },
            select: { roleId: true },
        }),
    ]);

    const heldRoleIds = effectiveRoleIds(
        assignments.map((assignment) => assignment.roleId),
        inclusions,
    );
    const pendingRoleIds = new Set(pendingRequests.map((request) => request.roleId));

    return roles
        .filter((role) => {
            if (heldRoleIds.has(role.id)) return false;
            return canRequestRole(
                role.requestMode,
                role.requestVisibilityRules.map((rule) => rule.requiredRoleId),
                heldRoleIds,
            );
        })
        .map((role) => ({
            id: role.id,
            roleName: role.roleName,
            scopeType: role.scopeType,
            pending: pendingRoleIds.has(role.id),
        }));
}
