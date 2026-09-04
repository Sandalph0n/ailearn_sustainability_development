import { NextRequest, NextResponse } from 'next/server';

import { badId, prismaError } from '@/lib/admin/route-helpers';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { guardInstitutionAction } from '@/lib/auth/institution-route-guard';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/scope-requests/[id]/reject'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.ROLE_REQUEST_REVIEW,
    );
    if (!guard.ok) return guard.response;

    try {
        const result = await db.scopeAssignmentRequest.updateMany({
            where: {
                id,
                status: 'PENDING',
                offering: { subject: { institutionId } },
                roleAssignment: { role: { institutionId } },
            },
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
        return prismaError(error, 'Subject access request');
    }
}
