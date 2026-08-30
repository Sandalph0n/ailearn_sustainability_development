// Duyệt request và tạo RoleAssignment trong cùng một transaction.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import {
    RoleAssignmentConfigurationError,
    validateRoleAssignment,
} from '@/lib/admin/role-assignment-configuration';
import { badId, guardDelete, prismaError } from '@/lib/admin/route-helpers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

class RequestAlreadyProcessedError extends Error {}

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/role-requests/[id]/approve'>,
): Promise<NextResponse> {
    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        const result = await db.$transaction(async (tx) => {
            // Khoá theo request để hai admin không thể cùng tạo hai assignment từ một đơn.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`role-request:${id}`}, 0))`;
            const roleRequest = await tx.roleRequest.findUnique({
                where: { id },
                select: { userId: true, roleId: true, status: true },
            });
            if (!roleRequest) throw new RequestAlreadyProcessedError('Request does not exist');
            if (roleRequest.status !== 'PENDING') {
                throw new RequestAlreadyProcessedError('This request has already been processed');
            }

            const assignmentData = {
                userId: roleRequest.userId,
                roleId: roleRequest.roleId,
                offeringId: null,
            };
            await validateRoleAssignment(tx, assignmentData);
            const assignment = await tx.roleAssignment.create({
                data: assignmentData,
                select: { id: true },
            });
            await tx.roleRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    processedAt: new Date(),
                    processedByUserId: guard.session.user.id,
                    approvedAssignmentId: assignment.id,
                },
            });
            return assignment;
        });
        return jsonResponse({ assignment: result });
    } catch (error) {
        if (error instanceof RequestAlreadyProcessedError) {
            return errorResponse(409, 'REQUEST_ALREADY_PROCESSED', error.message);
        }
        if (error instanceof RoleAssignmentConfigurationError) {
            return errorResponse(409, 'ROLE_ALREADY_ASSIGNED', error.message);
        }
        return prismaError(error, 'Role request');
    }
}
