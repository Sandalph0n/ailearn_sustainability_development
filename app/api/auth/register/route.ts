// Route này tạo tài khoản, tạo phiên đăng nhập và đặt cookie cho người dùng mới.
import { NextRequest, NextResponse } from 'next/server';

import { Prisma } from '@/app/generated/prisma/client';
import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
    jsonResponse,
} from '@/lib/auth/http/response';
import { applyAutoGrantedRoles } from '@/lib/auth/auto-grant';
import { hashPassword } from '@/lib/auth/password/hash';
import { prepareSession, setSessionCookie } from '@/lib/auth/session/service';
import { formatValidationErrors, SignUpSchema } from '@/lib/auth/validation/credentials';
import { db } from '@/lib/db';

// Argon2 là addon nhị phân của Node, không chạy được trên edge runtime.
export const runtime = 'nodejs';

/**
 * Đăng ký tài khoản, và đăng nhập luôn.
 *
 * ─── Thứ tự các bước: RẺ TRƯỚC, ĐẮT SAU ──────────────────────────────────────
 *
 * Đây là endpoint công khai, ai cũng gọi được. Nên mọi phép loại bỏ đặt trước theo giá của nó:
 *
 *     1. kiểm origin      chỉ đọc vài header          ~0ms
 *     2. đọc body         đọc tối đa 16KB             ~0ms
 *     3. kiểm định dạng   chạy Zod                    ~0ms
 *     4. tra email trùng  một truy vấn có index       ~1ms
 *     5. băm mật khẩu     Argon2, cố ý chậm           ~50-100ms  ← đắt nhất
 *     6. ghi database     transaction                 ~5ms
 *
 * Đảo bước 5 lên trước bước 1 thì kẻ tấn công chỉ cần bắn request rác là chiếm sạch CPU.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    const body = await readAuthJson(request);
    if (!body.ok) {
        return invalidBodyResponse(body.reason);
    }

    const parsed = SignUpSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Registration data is invalid',
            formatValidationErrors(parsed.error),
        );
    }

    const { email, password, firstName, lastName } = parsed.data;

    /**
     * Tra email trùng trước để trả về thông báo tử tế.
     *
     * Phép tra này KHÔNG đảm bảo đúng: giữa lúc tra và lúc ghi, một request khác có thể chen vào
     * và tạo cùng email đó. Thứ thật sự chặn trùng là ràng buộc `@unique` trên cột `email` —
     * xem `catch (P2002)` ở cuối. Ở đây chỉ để tránh tiêu 100ms băm mật khẩu một cách vô ích.
     *
     * (Chỗ này có đánh đổi: trả lời "email đã được dùng" là xác nhận cho người hỏi biết ai đã
     * có tài khoản ở đây. Gần như mọi form đăng ký đều chấp nhận, vì không nói thì người dùng
     * mắc kẹt không hiểu vì sao đăng ký hỏng.)
     */
    const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
        return errorResponse(409, 'EMAIL_ALREADY_EXISTS', 'Email is already in use');
    }

    const passwordHash = await hashPassword(password);

    try {
        // Tạo user và phiên trong CÙNG một transaction. Tách ra thì có thể tạo được tài khoản
        // rồi hỏng ở bước tạo phiên, để lại một tài khoản mà người dùng không biết mình đã có.
        const result = await db.$transaction(async (transaction) => {
            const user = await transaction.user.create({
                data: { email, passwordHash, firstName, lastName },
                select: { id: true, email: true, firstName: true, lastName: true },
            });

            const session = prepareSession(user.id);
            await transaction.loginSession.create({ data: session.record });

            // Tự cấp vai trò theo email (ví dụ @students.mq.edu.au → Student). Nằm TRONG cùng
            // transaction: nếu bước này hỏng thì cả tài khoản lẫn phiên đều được cuộn lại, không
            // để lại một user cấp dở vai trò.
            const grantedRoleIds = await applyAutoGrantedRoles(transaction, user.id, user.email);

            return { user, session, grantedRoleIds };
        });

        // Đặt cookie SAU khi transaction xong. Làm trước mà transaction hỏng thì trình duyệt
        // cầm một token không có phiên nào tương ứng.
        await setSessionCookie(result.session.token, result.session.expiresAt);

        return jsonResponse(
            {
                user: result.user,
                session: { expiresAt: result.session.expiresAt },
            },
            { status: 201 },
        );
    } catch (error) {
        // P2002 = vi phạm ràng buộc duy nhất. Đây là lưới an toàn thật sự cho email trùng: hai
        // request cùng lúc đều vượt qua phép tra bên trên, nhưng chỉ một cái ghi được.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return errorResponse(409, 'EMAIL_ALREADY_EXISTS', 'Email is already in use');
        }

        // Ghi log đầy đủ ở server, nhưng KHÔNG trả chi tiết lỗi ra ngoài — thông báo lỗi của
        // database hay lộ tên bảng, tên cột, và cả câu truy vấn.
        console.error('Failed to create account', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to create account');
    }
}
