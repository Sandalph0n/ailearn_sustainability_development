import { NextRequest, NextResponse } from 'next/server';

import { badId, prismaError } from '@/lib/admin/route-helpers';
import { guardInstitutionAction } from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import {
    assertCanManageProtectedRole,
    assertNotLastActiveChiefAssignment,
    DelegationPolicyError,
} from '@/lib/auth/delegation-policy';
import { db } from '@/lib/db';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/role-assignments/[id]/revoke'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;
    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.ROLE_ASSIGNMENT_REVOKE,
    );
    if (!guard.ok) return guard.response;

    const current = await db.roleAssignment.findFirst({
        where: { id, role: { institutionId }, roleRevokedAt: null },
        select: { id: true, roleId: true },
    });
    if (!current) return errorResponse(404, 'NOT_FOUND', 'Active role assignment does not exist');

    try {
        const assignment = await db.$transaction(async (tx) => {
            await assertCanManageProtectedRole(
                tx,
                institutionId,
                current.roleId,
                guard.session.user.id,
            );
            await assertNotLastActiveChiefAssignment(tx, institutionId, current.id);
            return tx.roleAssignment.update({
                where: { id },
                data: { roleRevokedAt: new Date() },
                select: { id: true, roleRevokedAt: true },
            });
        });
        return jsonResponse({ assignment });
    } catch (error) {
        if (error instanceof DelegationPolicyError) {
            return errorResponse(409, 'RESOURCE_IN_USE', error.message);
        }
        return prismaError(error, 'Active role assignment');
    }
}
