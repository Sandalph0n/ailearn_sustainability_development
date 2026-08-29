// Route này bật/tắt quyền quản trị toàn hệ thống của một tài khoản.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { badId, prismaError } from '@/lib/admin/route-helpers';
import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import { invalidBodyResponse, invalidOriginResponse } from '@/lib/auth/http/response';
import { requireSystemAdmin } from '@/lib/auth/require-admin';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const PatchSchema = z.strictObject({ isSystemAdmin: z.boolean() });

/**
 * Chỉ sửa được ĐÚNG MỘT trường: cờ quản trị.
 *
 * ─── Vì sao không có CRUD đầy đủ cho User ───────────────────────────────────
 *
 * Tài khoản do chính người dùng tạo qua đăng ký, và họ sở hữu dữ liệu của mình. Cho quản trị
 * viên sửa email hay tên người khác là mở một đường mạo danh: mọi bài nộp trong hệ thống đều
 * gắn với một `userId`, nên đổi được danh tính là đổi được ai đã làm bài nào.
 *
 * Cũng không có `DELETE`: `AssessmentAttempt` và `RoleAssignment` đều `Restrict`, và với một hệ
 * thống lấy liêm chính học thuật làm cốt lõi thì xoá tài khoản là xoá bằng chứng.
 */
export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/users/[id]'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();

    const guard = await requireSystemAdmin();
    if (!guard.ok) return guard.response;

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);

    const parsed = PatchSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(400, 'VALIDATION_ERROR', 'User data is invalid');
    }

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    /**
     * Không cho tự gỡ quyền của CHÍNH MÌNH.
     *
     * Người quản trị cuối cùng gỡ quyền của mình là khoá cửa từ bên trong: không còn ai vào được
     * khu quản trị để cấp lại, và lối thoát duy nhất là sửa thẳng database.
     *
     * Chặn theo "chính mình" chứ không phải "người cuối cùng": nó đơn giản hơn, không có tranh
     * chấp giữa hai request đồng thời, và vẫn giữ được ít nhất một cửa mở.
     */
    if (id === guard.session.user.id && !parsed.data.isSystemAdmin) {
        return errorResponse(
            409,
            'RESOURCE_IN_USE',
            'You cannot remove your own admin access. Ask another admin to do it.',
        );
    }

    try {
        const user = await db.user.update({
            where: { id },
            data: { isSystemAdmin: parsed.data.isSystemAdmin },
            select: { id: true, email: true, isSystemAdmin: true },
        });
        return jsonResponse({ user });
    } catch (error) {
        return prismaError(error, 'User');
    }
}
