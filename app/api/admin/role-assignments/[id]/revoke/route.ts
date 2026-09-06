// Thu hồi thay vì xoá để lịch sử phân quyền còn nguyên.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import {
    assertNotLastActiveChiefAssignment,
    DelegationPolicyError,
} from '@/lib/auth/delegation-policy';
import { badId, guardDelete, prismaError } from '@/lib/admin/route-helpers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/role-assignments/[id]/revoke'>,
): Promise<NextResponse> {
    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    const current = await db.roleAssignment.findFirst({
        where: { id, roleRevokedAt: null },
        select: { id: true, role: { select: { institutionId: true } } },
    });
    if (!current) {
        return errorResponse(404, 'NOT_FOUND', 'Active role assignment does not exist');
    }

    try {
        const assignment = await db.$transaction(async (tx) => {
            await assertNotLastActiveChiefAssignment(
                tx,
                current.role.institutionId,
                current.id,
            );
            return tx.roleAssignment.update({
                where: { id, roleRevokedAt: null },
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
