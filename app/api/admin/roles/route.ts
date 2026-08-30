// Route này tạo vai trò mới.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { RoleSchema } from '@/lib/admin/role-schema';
import {
    RoleConfigurationError,
    syncRolePermissions,
    validateRoleConfiguration,
} from '@/lib/admin/role-configuration';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = await guardWrite(request, RoleSchema, 'Role');
    if (!guard.ok) return guard.response;

    try {
        const role = await db.$transaction(async (tx) => {
            await validateRoleConfiguration(tx, guard.data, null);
            const { includedRoleIds, permissionIds, ...roleData } = guard.data;
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
            return created;
        });
        return jsonResponse({ role }, { status: 201 });
    } catch (error) {
        if (error instanceof RoleConfigurationError) {
            return errorResponse(400, 'VALIDATION_ERROR', error.message, {
                [error.field]: [error.message],
            });
        }
        return prismaError(error, 'Role');
    }
}
