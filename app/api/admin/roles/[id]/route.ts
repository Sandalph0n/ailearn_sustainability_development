// Route này sửa và xoá một vai trò.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { badId, guardDelete, guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { RoleSchema } from '@/lib/admin/role-schema';
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

    /**
     * Vai trò không được bao gồm CHÍNH NÓ.
     *
     * `includedById` là quan hệ tự trỏ, nên một vòng lặp ở đây sẽ khiến bất kỳ phép duyệt cây
     * quyền nào chạy vô tận. Đây là ca ngắn nhất và cũng là ca dễ bấm nhầm nhất; vòng dài hơn
     * (A gồm B, B gồm A) cần một phép duyệt đầy đủ, để lại khi dựng phần phân quyền.
     */
    if (guard.data.includedById === id) {
        return errorResponse(400, 'VALIDATION_ERROR', 'A role cannot include itself', {
            includedById: ['A role cannot include itself'],
        });
    }

    try {
        const role = await db.role.update({
            where: { id },
            data: guard.data,
            select: { id: true, roleName: true },
        });
        return jsonResponse({ role });
    } catch (error) {
        return prismaError(error, 'Role');
    }
}

/**
 * Xoá một vai trò.
 *
 * `RoleAssignment` và `RoleRequest` trỏ tới `Role` bằng `Restrict`: vai trò đã gán cho ai, hoặc
 * đã có người xin, thì không xoá được. Vai trò con (`includes`) thì `SetNull` — chúng mất liên
 * kết cha chứ không chết theo.
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
