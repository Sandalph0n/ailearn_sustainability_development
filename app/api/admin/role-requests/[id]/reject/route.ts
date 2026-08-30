// Từ chối request bằng chuyển trạng thái nguyên tử; không xoá sự kiện đã xảy ra.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { badId, guardDelete, prismaError } from '@/lib/admin/route-helpers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/role-requests/[id]/reject'>,
): Promise<NextResponse> {
    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        const result = await db.roleRequest.updateMany({
            where: { id, status: 'PENDING' },
            data: {
                status: 'REJECTED',
                processedAt: new Date(),
                processedByUserId: guard.session.user.id,
            },
        });
        if (result.count !== 1) {
            return errorResponse(
                409,
                'REQUEST_ALREADY_PROCESSED',
                'This request does not exist or has already been processed',
            );
        }
        return jsonResponse({ rejected: true });
    } catch (error) {
        return prismaError(error, 'Role request');
    }
}
