import type { NextRequest } from 'next/server';

/**
 * Trần kích thước body cho auth API. 16KB thừa sức cho email + mật khẩu + tên.
 *
 * Đặt chặt như vậy vì đây là endpoint công khai: không có trần thì một request đơn lẻ đủ sức
 * bắt server nạp hàng trăm MB vào RAM.
 */
const MAX_AUTH_BODY_BYTES = 16 * 1024;

export type JsonBodyResult =
    | { ok: true; value: unknown }
    | { ok: false; reason: 'invalid_json' | 'too_large' | 'wrong_content_type' };

/**
 * Đọc body JSON của auth API, trả về kết quả có nhãn thay vì ném lỗi.
 *
 * Phép kiểm `Content-Type` KHÔNG chỉ để bắt lỗi client — nó là một lớp chống CSRF. Form HTML
 * thuần chỉ gửi được `urlencoded`, `multipart` hoặc `text/plain`; không có cách nào bắt nó gửi
 * `application/json`. Còn `fetch` với JSON thì kích hoạt preflight, và preflight sẽ bị chặn.
 * Nên bắt buộc JSON là tự động loại bỏ đường tấn công CSRF bằng form ẩn.
 */
export async function readAuthJson(request: NextRequest): Promise<JsonBodyResult> {
    // Cắt ở dấu `;` vì header thường có đuôi charset: `application/json; charset=utf-8`.
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
        return { ok: false, reason: 'wrong_content_type' };
    }

    // Kiểm `Content-Length` trước để từ chối sớm, nhưng KHÔNG tin nó: client tự khai và có thể
    // khai dối. Nên bên dưới còn đo lại độ dài thật sau khi đọc xong.
    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_BODY_BYTES) {
        return { ok: false, reason: 'too_large' };
    }

    try {
        const body = await request.text();
        // Đo theo BYTE chứ không phải ký tự — một ký tự tiếng Việt chiếm 3 byte UTF-8.
        if (new TextEncoder().encode(body).byteLength > MAX_AUTH_BODY_BYTES) {
            return { ok: false, reason: 'too_large' };
        }

        return { ok: true, value: JSON.parse(body) };
    } catch {
        return { ok: false, reason: 'invalid_json' };
    }
}

/** Header có thể mang nhiều giá trị ngăn bởi dấu phẩy khi đi qua nhiều proxy. Lấy cái đầu tiên. */
function firstHeaderValue(value: string | null): string | null {
    return value?.split(',', 1)[0].trim() || null;
}

export function isSameOriginRequest(request: NextRequest): boolean {
    if (request.headers.get('sec-fetch-site')?.toLowerCase() === 'cross-site') {
        return false;
    }

    const origin = request.headers.get('origin');
    if (!origin) {
        // Client ngoài trình duyệt không luôn gửi Origin. Trình duyệt gửi header này cho POST và không cho JS giả mạo.
        return true;
    }

    try {
        const requestUrl = new URL(request.url);
        const expectedHost =
            firstHeaderValue(request.headers.get('host')) ??
            firstHeaderValue(request.headers.get('x-forwarded-host')) ??
            requestUrl.host;
        const expectedProtocol =
            firstHeaderValue(request.headers.get('x-forwarded-proto')) ?? requestUrl.protocol.replace(':', '');
        const requestOrigin = new URL(origin);

        return requestOrigin.host === expectedHost && requestOrigin.protocol === `${expectedProtocol}:`;
    } catch {
        return false;
    }
}
