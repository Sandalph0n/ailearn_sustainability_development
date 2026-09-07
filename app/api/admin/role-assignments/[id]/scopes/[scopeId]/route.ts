import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { badId, guardDelete, prismaError } from '@/lib/admin/route-helpers';
import { db } from '@/lib/db';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/role-assignments/[id]/scopes/[scopeId]'>,
): Promise<NextResponse> {
    const { id, scopeId } = await params;
    const invalidAssignment = badId(id);
    if (invalidAssignment) return invalidAssignment;
    const invalidScope = badId(scopeId);
    if (invalidScope) return invalidScope;

    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const scope = await db.scopeAssignment.findFirst({
        where: { id: scopeId, roleAssignmentId: id, revokedAt: null },
        select: { id: true },
    });
    if (!scope) {
        return errorResponse(404, 'NOT_FOUND', 'Active offering scope does not exist');
    }

    try {
        const updated = await db.scopeAssignment.update({
            where: { id: scope.id },
            data: { revokedAt: new Date(), revokedById: guard.session.user.id },
            select: { id: true, revokedAt: true },
        });
        return jsonResponse({ scope: updated });
    } catch (error) {
        return prismaError(error, 'Scope assignment');
    }
}
