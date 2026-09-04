import { NextRequest, NextResponse } from 'next/server';

import { badId, prismaError } from '@/lib/admin/route-helpers';
import { guardInstitutionAction } from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
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
        PERMISSION_CODE.ROLE_ASSIGNMENT_MANAGE,
    );
    if (!guard.ok) return guard.response;

    const current = await db.roleAssignment.findFirst({
        where: { id, role: { institutionId }, roleRevokedAt: null },
        select: { id: true },
    });
    if (!current) return errorResponse(404, 'NOT_FOUND', 'Active role assignment does not exist');

    try {
        const assignment = await db.roleAssignment.update({
            where: { id },
            data: { roleRevokedAt: new Date() },
            select: { id: true, roleRevokedAt: true },
        });
        return jsonResponse({ assignment });
    } catch (error) {
        return prismaError(error, 'Active role assignment');
    }
}
