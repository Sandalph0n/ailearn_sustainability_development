import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session/cookie';

/**
 * Proxy — chạy trước mọi request tới trang. Từ Next.js 16, Middleware đổi tên thành Proxy.
 *
 * ─── ĐÂY LÀ PHÉP KIỂM LẠC QUAN, KHÔNG PHẢI PHÂN QUYỀN ────────────────────────
 *
 * Proxy chạy trên MỌI request, kể cả những request Next tự nạp trước khi người dùng bấm. Đụng
 * database ở đây là mỗi lần rê chuột qua một liên kết lại một truy vấn.
 *
 * Nên nó chỉ trả lời được: "có cookie phiên không?" — KHÔNG trả lời được "cookie đó còn hiệu lực
 * không". Cookie giả, cookie hết hạn, cookie của phiên đã thu hồi đều lọt qua đây.
 *
 * Phép kiểm THẬT vẫn phải nằm ở layout, page và route handler, bằng `getCurrentSession()` — nơi
 * có thể băm token rồi tra bảng `LoginSession`.
 *
 * Proxy chỉ là lớp lọc thô: nó tiết kiệm một lần dựng trang cho người rõ ràng chưa đăng nhập.
 */

/** Đường dẫn ai cũng vào được. So khớp CHÍNH XÁC, không theo tiền tố. */
const PUBLIC_PATHS = new Set(['/', '/auth']);

export default function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
    // Đã đăng nhập mà còn vào trang đăng nhập thì đưa thẳng vào ứng dụng.
    if (hasSessionCookie && pathname === '/auth') {
        return NextResponse.redirect(new URL('/navigation/dashboard', request.nextUrl));
    }

    if (!hasSessionCookie && !PUBLIC_PATHS.has(pathname)) {
        // `clone()` giữ nguyên giao thức, tên máy và cổng — thứ duy nhất cần lấy lại từ request,
        // vì địa chỉ đó khác nhau giữa máy dev, cổng dự phòng và tên miền thật.
        //
        // `search = ''` xoá query của trang cũ. Không có dòng này thì tham số của trang bị chặn
        // bám theo sang trang đăng nhập, lọt vào lịch sử trình duyệt và log máy chủ.
        //
        // `next` nhớ chỗ họ định tới, để đăng nhập xong quay lại đúng đó.
        const newTarget = request.nextUrl.clone();
        newTarget.pathname = '/auth';
        newTarget.search = '';
        newTarget.searchParams.set('next', pathname);

        return NextResponse.redirect(newTarget);
    }

    return NextResponse.next();
}

export const config = {
    /**
     * Bỏ qua API và tài nguyên tĩnh.
     *
     * Thiếu dòng này thì proxy chuyển hướng cả tệp `.js` sang trang HTML, và trình duyệt báo
     * `Unexpected token '<'` cho mọi chunk.
     *
     * Phải là hằng số viết thẳng — Next đọc nó lúc build, ghép chuỗi hay dùng biến thì nó không
     * đọc được.
     */
    matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|svg|ico)$).*)'],
};
