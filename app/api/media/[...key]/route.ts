// Route này phục vụ ảnh trong bucket `media` cho trình duyệt.
import { NextResponse } from 'next/server';

import { errorResponse } from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { isMediaKey } from '@/lib/storage/keys';
import { getObject } from '@/lib/storage/objects';

export const runtime = 'nodejs';

/**
 * ─── Vì sao đi vòng qua server thay vì URL đã ký ─────────────────────────────
 *
 * URL đã ký mang theo `X-Amz-Date` và `X-Amz-Signature`, đổi mỗi lần sinh. Trình duyệt đánh dấu
 * bản sao trong máy theo ĐỊA CHỈ, nên địa chỉ luôn khác nghĩa là bản sao không bao giờ dùng được
 * — mỗi lần vào trang lại tải lại toàn bộ ảnh đại diện.
 *
 * Đường dẫn ở đây cố định theo khoá, mà khoá đổi mỗi lần tải ảnh mới. Vậy là địa chỉ đổi KHI VÀ
 * CHỈ KHI nội dung đổi, và khai báo `immutable` bên dưới trở thành đúng theo nghĩa đen.
 *
 * Đánh đổi: mọi byte đi qua Node. Chấp nhận được với ảnh đại diện vài chục KB; `Document` và bản
 * lưu trữ thì sẽ dùng URL đã ký.
 */
const ONE_YEAR_SECONDS = 31_536_000;

export async function GET(
    _request: Request,
    { params }: RouteContext<'/api/media/[...key]'>,
): Promise<NextResponse | Response> {
    const session = await getCurrentSession();
    if (!session) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');
    }

    // `key` là mảng vì `[...key]` bắt nhiều đoạn. Nối lại thành khoá gốc `avatar/<id>/<hậu tố>`.
    const { key } = await params;
    const objectKey = key.join('/');

    // Khoá đến TỪ URL, tức là từ người dùng. Không kiểm thì gõ khoá nào cũng đọc được đối tượng
    // đó trong bucket `media`.
    if (!isMediaKey(objectKey)) {
        return errorResponse(404, 'NOT_FOUND', 'Picture not found');
    }

    const object = await getObject({ bucket: 'media', key: objectKey });
    if (!object) {
        return errorResponse(404, 'NOT_FOUND', 'Picture not found');
    }

    return new Response(object.body, {
        headers: {
            'Content-Type': object.contentType,
            ...(object.contentLength ? { 'Content-Length': String(object.contentLength) } : {}),
            // `private` vì phản hồi này chỉ dành cho một phiên đăng nhập — proxy dùng chung không
            // được giữ lại. Trình duyệt của chính người đó thì vẫn giữ, và đó là chỗ cần cache.
            'Cache-Control': `private, max-age=${ONE_YEAR_SECONDS}, immutable`,
        },
    });
}
