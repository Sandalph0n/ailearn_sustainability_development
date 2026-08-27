// Route này thu hồi toàn bộ phiên đang tồn tại của tài khoản, trên mọi thiết bị.
import { NextRequest, NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth/http/request';
import { errorResponse, invalidOriginResponse } from '@/lib/auth/http/response';
import { revokeAllCurrentUserSessions } from '@/lib/auth/session/service';

export const runtime = 'nodejs';

/**
 * Đăng xuất khỏi mọi thiết bị.
 *
 * Đây là nút bấm khi ai đó nghi tài khoản mình bị lộ, hoặc quên đăng xuất ở máy phòng lab. Nó
 * cũng là lý do phiên được lưu trong database thay vì dùng JWT thuần: JWT đã phát ra thì không
 * thu hồi được cho tới lúc hết hạn, còn ở đây xoá vài dòng là mọi thiết bị chết ngay.
 *
 * ─── Vì sao ở đây LẠI báo lỗi khi chưa đăng nhập, khác với `logout` ──────────
 *
 * `logout` không cần biết bạn là ai — nó chỉ vứt cái cookie đang cầm. Còn route này phải TRA RA
 * bạn là ai mới biết cần xoá phiên của tài khoản nào. Không xác định được thì nó thật sự không
 * làm gì cả, và nói dối rằng đã làm là tệ hơn: người dùng tưởng mình vừa khoá hết thiết bị.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    const revoked = await revokeAllCurrentUserSessions();
    if (!revoked) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
    }

    return new NextResponse(null, { status: 204 });
}
