// Route này thu hồi phiên của thiết bị hiện tại và xoá cookie đăng nhập.
import { NextRequest, NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth/http/request';
import { invalidOriginResponse } from '@/lib/auth/http/response';
import { revokeCurrentSession } from '@/lib/auth/session/service';

export const runtime = 'nodejs';

/**
 * Đăng xuất thiết bị hiện tại.
 *
 * ─── Vì sao POST chứ không phải GET ──────────────────────────────────────────
 *
 * GET phải là thao tác không đổi trạng thái. Để đăng xuất ở GET thì bất kỳ ai cũng nhúng được
 * `<img src="/api/auth/logout">` vào một trang bất kỳ và đá người dùng ra khỏi ứng dụng — phiền
 * chứ không nguy hiểm, nhưng không có lý do gì để mở cửa đó.
 *
 * ─── Vì sao không kiểm đã đăng nhập hay chưa ─────────────────────────────────
 *
 * Đăng xuất khi vốn chưa đăng nhập vẫn trả 204. Kết quả mong muốn — "phiên này không còn hiệu
 * lực" — đã đúng sẵn rồi. Báo lỗi ở đây chỉ khiến phía giao diện phải xử lý một ca chẳng để làm
 * gì. `revokeCurrentSession` xoá cookie kể cả khi không có token.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    await revokeCurrentSession();

    // 204 = thành công, không có nội dung trả về. Client chỉ cần biết là xong.
    return new NextResponse(null, { status: 204 });
}
