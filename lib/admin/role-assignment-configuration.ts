// File này kiểm scope của role và ngăn cấp trùng một assignment còn hiệu lực.
import 'server-only';

import type { Prisma } from '@/app/generated/prisma/client';
import type { RoleAssignmentSchemaValue } from '@/lib/admin/role-assignment-schema';

export class RoleAssignmentConfigurationError extends Error {
    constructor(
        message: string,
        readonly field: 'userId' | 'roleId' | 'offeringId',
    ) {
        super(message);
    }
}

export async function validateRoleAssignment(
    tx: Prisma.TransactionClient,
    data: RoleAssignmentSchemaValue,
): Promise<void> {
    const [user, role, offering] = await Promise.all([
        tx.user.findUnique({ where: { id: data.userId }, select: { id: true } }),
        tx.role.findUnique({
            where: { id: data.roleId },
            select: { institutionId: true, scopeType: true },
        }),
        data.offeringId
            ? tx.offering.findUnique({
                  where: { id: data.offeringId },
                  select: { subject: { select: { institutionId: true } } },
              })
            : null,
    ]);

    if (!user) throw new RoleAssignmentConfigurationError('User does not exist', 'userId');
    if (!role) throw new RoleAssignmentConfigurationError('Role does not exist', 'roleId');

    if (role.scopeType === 'INSTITUTION' && data.offeringId !== null) {
        throw new RoleAssignmentConfigurationError(
            'This role must be granted institution-wide',
            'offeringId',
        );
    }
    // OFFERING role không có offering là một role identity chưa được scope. Nó không tạo ra
    // context hay quyền trên offering nào; offering cụ thể có thể được gắn sau.
    if (data.offeringId && (!offering || offering.subject.institutionId !== role.institutionId)) {
        throw new RoleAssignmentConfigurationError(
            'Offering and role must belong to the same institution',
            'offeringId',
        );
    }

    const duplicate = await tx.roleAssignment.findFirst({
        where: {
            userId: data.userId,
            roleId: data.roleId,
            offeringId: data.offeringId,
            roleRevokedAt: null,
        },
        select: { id: true },
    });
    if (duplicate) {
        throw new RoleAssignmentConfigurationError(
            'This user already holds that role in the selected scope',
            'roleId',
        );
    }
}
