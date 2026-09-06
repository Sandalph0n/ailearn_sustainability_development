// Route này sửa và xoá một vai trò.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { badId, guardDelete, guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { RoleSchema } from '@/lib/admin/role-schema';
import {
    RoleConfigurationError,
    syncRoleRequestVisibility,
    syncRolePermissions,
    validateRoleConfiguration,
} from '@/lib/admin/role-configuration';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/roles/[id]'>,
): Promise<NextResponse> {
    const guard = await guardWrite(request, RoleSchema, 'Role');
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        const role = await db.$transaction(async (tx) => {
            await validateRoleConfiguration(tx, guard.data, id);
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
        return prismaError(error, 'Role');
    }
}

/**
 * Xoá một vai trò.
 *
 * `RoleAssignment` và `RoleRequest` trỏ tới `Role` bằng `Restrict`: vai trò đã gán cho ai, hoặc
 * đã có người xin, thì không xoá được. Các cạnh kế thừa bị xoá theo, vai trò ở đầu kia vẫn còn.
 */
export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/roles/[id]'>,
): Promise<NextResponse> {
    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        await db.role.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Role', {
            inUse: 'This role is assigned to someone, or has been requested, so it cannot be deleted.',
        });
    }
}
