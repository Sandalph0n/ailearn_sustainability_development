import { NextRequest, NextResponse } from 'next/server';

import {
    RoleConfigurationError,
    syncRoleRequestVisibility,
    syncRolePermissions,
    validateRoleConfiguration,
} from '@/lib/admin/role-configuration';
import { RoleSchema } from '@/lib/admin/role-schema';
import { badId, prismaError } from '@/lib/admin/route-helpers';
import {
    guardInstitutionAction,
    guardInstitutionWrite,
} from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import {
    assertCanDefineRole,
    CHIEF_MANAGEMENT_ROLE_CODE,
    DelegationPolicyError,
} from '@/lib/auth/delegation-policy';
import { db } from '@/lib/db';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/roles/[id]'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;
    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.ROLE_UPDATE,
        RoleSchema,
        'Role',
    );
    if (!guard.ok) return guard.response;
    if (guard.data.institutionId !== institutionId) {
        return errorResponse(400, 'VALIDATION_ERROR', 'A role cannot be moved', {
            institutionId: ['A role cannot be moved to another institution'],
        });
    }

    try {
        const role = await db.$transaction(async (tx) => {
            const current = await tx.role.findFirst({
                where: { id, institutionId },
                select: { id: true, roleCode: true },
            });
            if (!current) throw new RoleConfigurationError('Role does not exist', 'includedRoleIds');
            if (
                current.roleCode === CHIEF_MANAGEMENT_ROLE_CODE ||
                guard.data.roleCode === CHIEF_MANAGEMENT_ROLE_CODE
            ) {
                throw new DelegationPolicyError(
                    'The protected Chief Management definition can only be changed by a system administrator',
                );
            }
            await validateRoleConfiguration(tx, guard.data, id);
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
            const updated = await tx.role.update({
                where: { id },
                data: roleData,
                select: { id: true, roleName: true },
            });
            await tx.roleInclusion.deleteMany({ where: { includingRoleId: id } });
            if (includedRoleIds.length > 0) {
                await tx.roleInclusion.createMany({
                    data: includedRoleIds.map((includedRoleId) => ({
                        includingRoleId: id,
                        includedRoleId,
                    })),
                });
            }
            await syncRolePermissions(tx, id, permissionIds);
            await syncRoleRequestVisibility(tx, id, prerequisiteRoleIds);
            return updated;
        });
        return jsonResponse({ role });
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

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/roles/[id]'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;
    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.ROLE_DELETE,
    );
    if (!guard.ok) return guard.response;

    const role = await db.role.findFirst({
        where: { id, institutionId },
        select: { roleCode: true },
    });
    if (!role) return errorResponse(404, 'NOT_FOUND', 'Role does not exist');
    if (role.roleCode === CHIEF_MANAGEMENT_ROLE_CODE) {
        return errorResponse(
            403,
            'AUTHORIZATION_FORBIDDEN',
            'The protected Chief Management definition cannot be deleted here',
        );
    }

    try {
        await db.role.delete({ where: { id, institutionId } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Role', {
            inUse: 'This role is assigned to someone, or has been requested, so it cannot be deleted.',
        });
    }
}
