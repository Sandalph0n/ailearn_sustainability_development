import { NextRequest, NextResponse } from 'next/server';

import { badId, prismaError } from '@/lib/admin/route-helpers';
import { guardInstitutionAction } from '@/lib/auth/institution-route-guard';
import { errorResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/scope-codes/[id]'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_REVOKE,
    );
    if (!guard.ok) return guard.response;

    const code = await db.scopeAssignmentCode.findFirst({
        where: { id, offering: { subject: { institutionId } } },
        select: { id: true, usedAt: true, revokedAt: true },
    });
    if (!code) return errorResponse(404, 'NOT_FOUND', 'Access code does not exist');
    if (code.usedAt) {
        return errorResponse(409, 'RESOURCE_IN_USE', 'A used access code cannot be revoked');
    }
    if (code.revokedAt) return errorResponse(409, 'RESOURCE_IN_USE', 'Access code is already revoked');

    try {
        await db.scopeAssignmentCode.update({
            where: { id },
            data: { revokedAt: new Date(), revokedById: guard.session.user.id },
        });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Unused access code');
    }
}
