import { NextRequest, NextResponse } from 'next/server';

import {
    RoleConfigurationError,
    syncRoleRequestVisibility,
    syncRolePermissions,
    validateRoleConfiguration,
} from '@/lib/admin/role-configuration';
import { RoleSchema } from '@/lib/admin/role-schema';
import { prismaError } from '@/lib/admin/route-helpers';
import { guardInstitutionWrite } from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import {
    assertCanDefineRole,
    CHIEF_MANAGEMENT_ROLE_CODE,
    DelegationPolicyError,
} from '@/lib/auth/delegation-policy';
import { db } from '@/lib/db';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/roles'>,
): Promise<NextResponse> {
    const { institutionId } = await params;
    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.ROLE_CREATE,
        RoleSchema,
        'Role',
    );
    if (!guard.ok) return guard.response;
    if (guard.data.institutionId !== institutionId) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Use the active institution', {
            institutionId: ['Use the active institution'],
        });
    }
    if (guard.data.roleCode === CHIEF_MANAGEMENT_ROLE_CODE) {
        return errorResponse(
            403,
            'AUTHORIZATION_FORBIDDEN',
            'The protected Chief Management definition can only be created by a system administrator',
        );
    }

    try {
        const role = await db.$transaction(async (tx) => {
            await validateRoleConfiguration(tx, guard.data, null);
            await assertCanDefineRole(
                tx,
                institutionId,
                guard.data.permissionIds,
                guard.data.includedRoleIds,
                guard.context.permissions,
            );
            const {
                includedRoleIds,
                permissionIds,
                prerequisiteRoleIds,
                ...roleData
            } = guard.data;
            const created = await tx.role.create({
                data: roleData,
                select: { id: true, roleName: true },
            });
            if (includedRoleIds.length > 0) {
                await tx.roleInclusion.createMany({
                    data: includedRoleIds.map((includedRoleId) => ({
                        includingRoleId: created.id,
                        includedRoleId,
                    })),
                });
            }
            await syncRolePermissions(tx, created.id, permissionIds);
            await syncRoleRequestVisibility(tx, created.id, prerequisiteRoleIds);
            return created;
        });
        return jsonResponse({ role }, { status: 201 });
    } catch (error) {
        if (error instanceof RoleConfigurationError) {
            return errorResponse(400, 'VALIDATION_ERROR', error.message, {
                [error.field]: [error.message],
            });
        }
        if (error instanceof DelegationPolicyError) {
            return errorResponse(403, 'AUTHORIZATION_FORBIDDEN', error.message);
        }
        return prismaError(error, 'Role');
    }
}
