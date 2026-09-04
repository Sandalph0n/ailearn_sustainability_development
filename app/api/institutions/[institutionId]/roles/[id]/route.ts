import { NextRequest, NextResponse } from 'next/server';

import {
    RoleConfigurationError,
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
                select: { id: true },
            });
            if (!current) throw new RoleConfigurationError('Role does not exist', 'includedRoleIds');
            await validateRoleConfiguration(tx, guard.data, id);
            const { includedRoleIds, permissionIds, ...roleData } = guard.data;
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
            return updated;
        });
        return jsonResponse({ role });
    } catch (error) {
        if (error instanceof RoleConfigurationError) {
            return errorResponse(400, 'VALIDATION_ERROR', error.message, {
                [error.field]: [error.message],
            });
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

    try {
        await db.role.delete({ where: { id, institutionId } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Role', {
            inUse: 'This role is assigned to someone, or has been requested, so it cannot be deleted.',
        });
    }
}
