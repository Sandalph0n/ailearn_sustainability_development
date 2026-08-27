// Route này đọc cookie, đối chiếu phiên trong database và trả về người dùng hiện tại.
import { NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';

export const runtime = 'nodejs';

/**
 * "Tôi đang là ai?"
 *
 * ─── Đây mới là phép kiểm THẬT ───────────────────────────────────────────────
 *
 * `proxy.ts` chỉ nhìn được cookie có tồn tại hay không — cookie giả, hết hạn, hay thuộc phiên đã
 * thu hồi đều lọt qua đó. Route này băm token rồi tra bảng `LoginSession` kèm điều kiện còn hạn,
 * nên nó trả lời được điều proxy không trả lời được.
 *
 * ─── Vì sao GET, và vì sao không cần kiểm origin ─────────────────────────────
 *
 * Nó chỉ đọc, không đổi gì. CSRF là tấn công khiến trình duyệt nạn nhân THỰC HIỆN một hành động
 * ngoài ý muốn — với một endpoint chỉ đọc thì không có hành động nào để lợi dụng. Kẻ tấn công có
 * bắt được trình duyệt gọi route này cũng không đọc được phản hồi, vì same-origin policy chặn.
 *
 * `jsonResponse` đặt `Cache-Control: no-store`, quan trọng ở đây hơn mọi chỗ khác: phản hồi này
 * chứa danh tính một người cụ thể, bị proxy hay trình duyệt cache lại là người sau nhận nhầm.
 */
export async function GET(): Promise<NextResponse> {
    const currentSession = await getCurrentSession();
    if (!currentSession) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
    }

    return jsonResponse({
        user: currentSession.user,
        session: { expiresAt: currentSession.session.expiresAt },
    });
}
