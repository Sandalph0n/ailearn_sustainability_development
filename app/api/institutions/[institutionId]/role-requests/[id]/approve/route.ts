import { NextRequest, NextResponse } from 'next/server';

import {
    RoleAssignmentConfigurationError,
    validateRoleAssignment,
} from '@/lib/admin/role-assignment-configuration';
import { badId, prismaError } from '@/lib/admin/route-helpers';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { guardInstitutionAction } from '@/lib/auth/institution-route-guard';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

class RequestAlreadyProcessedError extends Error {}

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/role-requests/[id]/approve'>,
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
        const assignment = await db.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`role-request:${id}`}, 0))`;
            const roleRequest = await tx.roleRequest.findFirst({
                where: { id, institutionId },
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
            const created = await tx.roleAssignment.create({
                data: {
                    userId: assignmentData.userId,
                    roleId: assignmentData.roleId,
                },
                select: { id: true },
            });
            await tx.roleRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    processedAt: new Date(),
                    processedByUserId: guard.session.user.id,
                    approvedAssignmentId: created.id,
                },
            });
            return created;
        });

        return jsonResponse({ assignment });
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
