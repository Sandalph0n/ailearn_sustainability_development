// Thu hồi thay vì xoá để lịch sử phân quyền còn nguyên.
import { NextRequest, NextResponse } from 'next/server';

import { jsonResponse } from '@/lib/auth/http/response';
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

    try {
        const assignment = await db.roleAssignment.update({
            where: { id, roleRevokedAt: null },
            data: { roleRevokedAt: new Date() },
            select: { id: true, roleRevokedAt: true },
        });
        return jsonResponse({ assignment });
    } catch (error) {
        return prismaError(error, 'Active role assignment');
    }
}
