// File này là chốt chặn quyền quản trị dùng cho các route API dưới `/api/admin/`.
import 'server-only';

import type { NextResponse } from 'next/server';

import { errorResponse } from '@/lib/auth/http/response';
import { getCurrentSession, type AuthSession } from '@/lib/auth/session/service';

type AdminGuardResult =
    | { ok: true; session: AuthSession }
    | { ok: false; response: NextResponse };

/**
 * Chặn mọi request không phải của quản trị viên toàn hệ thống.
 *
 * ─── Vì sao route API vẫn phải tự kiểm dù layout đã chặn ────────────────────
 *
 * `app/admin/layout.tsx` chỉ ngăn GIAO DIỆN hiện ra. Nó không đứng giữa `/api/admin/...` và
 * database — bất kỳ ai cũng `curl` thẳng vào endpoint được, không đi qua trang nào. Chốt chặn ở
 * layout là để người dùng đỡ bối rối; chốt chặn ở đây mới là thứ bảo vệ dữ liệu.
 *
 * ─── Vì sao 404 chứ không phải 403 ──────────────────────────────────────────
 *
 * 403 xác nhận endpoint có thật và người gọi chỉ thiếu quyền — đủ để dò ra bản đồ khu quản trị.
 * 404 thì không nói gì thêm ngoài điều họ đã biết.
 *
 * Khác với `/admin` ở giao diện, nơi ta CỐ Ý không giấu: người thật gõ nhầm đường dẫn cần được
 * nói cho biết, còn script dò endpoint thì không.
 *
 * ─── Trả về kết quả có nhãn, không ném lỗi ──────────────────────────────────
 *
 * Ném lỗi thì mỗi route phải bọc `try/catch` chỉ để bắt đúng một ca đã biết trước. Trả về
 * `{ ok: false, response }` khiến chỗ gọi buộc phải xử lý — quên là TypeScript kêu.
 */
export async function requireSystemAdmin(): Promise<AdminGuardResult> {
    const session = await getCurrentSession();

    if (!session || !session.user.isSystemAdmin) {
        return {
            ok: false,
            response: errorResponse(404, 'NOT_FOUND', 'Not found'),
        };
    }

    return { ok: true, session };
}
