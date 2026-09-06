import { NextRequest, NextResponse } from 'next/server';

import {
    RoleAssignmentConfigurationError,
    validateRoleAssignment,
} from '@/lib/admin/role-assignment-configuration';
import { RoleAssignmentSchema } from '@/lib/admin/role-assignment-schema';
import { prismaError } from '@/lib/admin/route-helpers';
import { guardInstitutionWrite } from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import {
    assertCanDelegateRole,
    assertCanManageProtectedRole,
    DelegationPolicyError,
} from '@/lib/auth/delegation-policy';
import { db } from '@/lib/db';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/role-assignments'>,
): Promise<NextResponse> {
    const { institutionId } = await params;
    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.ROLE_ASSIGNMENT_CREATE,
        RoleAssignmentSchema,
        'Role assignment',
    );
    if (!guard.ok) return guard.response;

    try {
        const assignment = await db.$transaction(async (tx) => {
            const role = await tx.role.findFirst({
                where: { id: guard.data.roleId, institutionId },
                select: { id: true },
            });
            if (!role) {
                throw new RoleAssignmentConfigurationError(
                    'Role belongs to another institution',
                    'roleId',
                );
            }
            await assertCanDelegateRole(
                tx,
                institutionId,
                guard.data.roleId,
                guard.context.permissions,
            );
            await assertCanManageProtectedRole(
                tx,
                institutionId,
                guard.data.roleId,
                guard.session.user.id,
            );
            await validateRoleAssignment(tx, guard.data);
            const { offeringId, ...assignmentData } = guard.data;
            return tx.roleAssignment.create({
                data: {
                    ...assignmentData,
                    grantDirectlyById: guard.session.user.id,
                    ...(offeringId
                        ? {
                              scopeAssignments: {
                                  create: {
                                      offeringId,
                                      source: 'DIRECT',
                                      assignedDirectlyById: guard.session.user.id,
                                  },
                              },
                          }
                        : {}),
                },
                select: { id: true, roleGrantedAt: true },
            });
        });
        return jsonResponse({ assignment }, { status: 201 });
    } catch (error) {
        if (error instanceof RoleAssignmentConfigurationError) {
            return errorResponse(400, 'VALIDATION_ERROR', error.message, {
                [error.field]: [error.message],
            });
        }
        if (error instanceof DelegationPolicyError) {
            return errorResponse(403, 'AUTHORIZATION_FORBIDDEN', error.message);
        }
        return prismaError(error, 'Role assignment', {
            unique: 'This user already holds that role',
        });
    }
}
