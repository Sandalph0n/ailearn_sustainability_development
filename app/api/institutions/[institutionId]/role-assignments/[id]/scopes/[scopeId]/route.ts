import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { guardInstitutionAction } from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/role-assignments/[id]/scopes/[scopeId]'>,
): Promise<NextResponse> {
    const { institutionId, id, scopeId } = await params;
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(scopeId).success) return errorResponse(404, 'NOT_FOUND', 'Scope assignment not found');
    const guard = await guardInstitutionAction(request, institutionId, PERMISSION_CODE.SCOPE_ASSIGNMENT_REVOKE);
    if (!guard.ok) return guard.response;

    const scope = await db.scopeAssignment.findFirst({
        where: { id: scopeId, roleAssignmentId: id, revokedAt: null, roleAssignment: { role: { institutionId } } },
        select: { id: true },
    });
    if (!scope) return errorResponse(404, 'NOT_FOUND', 'Active scope assignment not found');

    await db.scopeAssignment.update({
        where: { id: scope.id },
        data: { revokedAt: new Date(), revokedById: guard.session.user.id },
    });
    return jsonResponse({ revoked: true });
}
