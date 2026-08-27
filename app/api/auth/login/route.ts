// Route này xác minh email/mật khẩu, nâng cấp password hash khi cần và cấp phiên mới.
import { NextRequest, NextResponse } from 'next/server';

import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
    jsonResponse,
} from '@/lib/auth/http/response';
import {
    hashPassword,
    passwordHashNeedsUpgrade,
    verifyPassword,
    verifyPasswordForMissingUser,
} from '@/lib/auth/password/hash';
import { replaceCurrentSession } from '@/lib/auth/session/service';
import { formatValidationErrors, LoginSchema } from '@/lib/auth/validation/credentials';
import { db } from '@/lib/db';

// Argon2 là addon nhị phân của Node, không chạy được trên edge runtime.
export const runtime = 'nodejs';

/**
 * Đăng nhập.
 *
 * ─── Vì sao mọi nhánh sai đều trả về CÙNG một thông báo ──────────────────────
 *
 * Email không tồn tại và mật khẩu sai đều trả `401 INVALID_CREDENTIALS`, cùng câu chữ. Tách ra
 * thành "email không tồn tại" với "mật khẩu sai" là biếu không cho kẻ tấn công một công cụ dò:
 * bắn một danh sách email vào đây là biết ai có tài khoản ở đây.
 *
 * ─── Vì sao vẫn phải băm khi không tìm thấy user ─────────────────────────────
 *
 * Câu chữ giống nhau vẫn chưa đủ, vì THỜI GIAN phản hồi tố cáo. Không tìm thấy user thì trả lời
 * sau ~1ms; tìm thấy rồi mới so mật khẩu thì mất ~50ms vì Argon2 cố ý chậm. Chênh lệch đó đo
 * được từ ngoài. `verifyPasswordForMissingUser` chạy Argon2 với một hash giả để hai nhánh tốn
 * thời gian tương đương.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    const body = await readAuthJson(request);
    if (!body.ok) {
        return invalidBodyResponse(body.reason);
    }

    const parsed = LoginSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Login data is invalid',
            formatValidationErrors(parsed.error),
        );
    }

    const { email, password } = parsed.data;

    // Lấy cả `passwordHash` — đây là một trong số rất ít chỗ được phép đọc cột đó.
    const user = await db.user.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            passwordHash: true,
            firstName: true,
            lastName: true,
        },
    });

    if (!user) {
        await verifyPasswordForMissingUser(password);
        return errorResponse(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }

    const passwordMatches = await verifyPassword(user.passwordHash, password);
    if (!passwordMatches) {
        return errorResponse(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }

    /**
     * Nâng cấp hash nếu tham số Argon2 đã đổi kể từ lần đặt mật khẩu.
     *
     * Đây là cơ hội DUY NHẤT để làm việc này: server không giữ mật khẩu gốc, nên không thể băm
     * lại hàng loạt. Chỉ ngay lúc này, khi mật khẩu vừa đi qua tay ta, mới băm lại được.
     *
     * `updateMany` với điều kiện kèm `passwordHash` cũ là một phép so-rồi-ghi: nếu một request
     * khác đã đổi mật khẩu xen vào giữa, điều kiện không khớp và lệnh này không ghi đè gì cả.
     * Dùng `update` theo `id` thì sẽ ghi đè mất mật khẩu mới.
     */
    if (passwordHashNeedsUpgrade(user.passwordHash)) {
        const upgradedHash = await hashPassword(password);
        await db.user.updateMany({
            where: { id: user.id, passwordHash: user.passwordHash },
            data: { passwordHash: upgradedHash },
        });
    }

    // Cấp phiên MỚI và huỷ phiên cũ. Xem `replaceCurrentSession` — việc huỷ phiên cũ là để
    // chống session fixation, không phải để dọn dẹp.
    const session = await replaceCurrentSession(user.id);

    return jsonResponse({
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
        },
        session,
    });
}
