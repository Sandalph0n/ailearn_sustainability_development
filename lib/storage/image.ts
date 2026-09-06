// File này đọc và kiểm phần thân của một request tải ảnh lên. Không chạm tới kho tệp.
import 'server-only';

import type { NextRequest } from 'next/server';

/**
 * Trần kích thước cho ảnh đại diện và logo.
 *
 * 2MB thừa sức cho một ảnh vuông vài trăm pixel. Đặt chặt vì đây là endpoint ai đăng nhập cũng
 * gọi được: không có trần thì một request đủ sức bắt server nạp hàng trăm MB vào RAM.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * ─── Nhận dạng bằng BYTE ĐẦU TỆP, không tin header ───────────────────────────
 *
 * `Content-Type` do client tự khai, nên nó nói gì cũng được. Mỗi định dạng ảnh mở đầu bằng một
 * chuỗi byte cố định — đó mới là thứ đáng tin, và nó chặn được việc tải một tệp thực thi lên rồi
 * dán nhãn `image/png`.
 *
 * Kiểu trả về chính là thứ sẽ ghi vào siêu dữ liệu của đối tượng, nên trình duyệt luôn nhận đúng
 * `Content-Type` bất kể client khai gì.
 */
const SIGNATURES = [
    { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
    { type: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
] as const;

export type ImageContentType = (typeof SIGNATURES)[number]['type'] | 'image/webp';

function startsWith(data: Uint8Array, prefix: readonly number[]): boolean {
    return prefix.every((byte, index) => data[index] === byte);
}

export function detectImageType(data: Uint8Array): ImageContentType | null {
    for (const { type, bytes } of SIGNATURES) {
        if (startsWith(data, bytes)) return type;
    }

    // WebP không nhận ra được bằng một tiền tố liền mạch: bốn byte `RIFF`, rồi bốn byte độ dài
    // thay đổi theo từng tệp, rồi mới tới `WEBP`.
    const RIFF = [0x52, 0x49, 0x46, 0x46];
    const WEBP = [0x57, 0x45, 0x42, 0x50];
    if (startsWith(data, RIFF) && WEBP.every((byte, index) => data[8 + index] === byte)) {
        return 'image/webp';
    }

    return null;
}

export type ImageUploadResult =
    | { ok: true; bytes: Uint8Array; contentType: ImageContentType }
    | { ok: false; reason: 'too_large' | 'not_an_image' };

/**
 * Đọc thân request thành một ảnh đã xác minh.
 *
 * ─── Vì sao là byte thô, không phải multipart ────────────────────────────────
 *
 * Không cần phân tích multipart, và giữ nguyên được lớp chống CSRF mà `readAuthJson` dựa vào:
 * form HTML thuần chỉ gửi được `urlencoded`, `multipart` hoặc `text/plain`. Một request mang
 * thân ảnh thô bắt buộc phải do `fetch` gửi, mà `fetch` xuyên trang thì bị preflight chặn.
 */
export async function readImageUpload(request: NextRequest): Promise<ImageUploadResult> {
    // Kiểm `Content-Length` trước để từ chối sớm, nhưng KHÔNG tin nó — client tự khai và khai
    // dối được. Bên dưới đo lại độ dài thật sau khi đọc xong.
    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
        return { ok: false, reason: 'too_large' };
    }

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
        return { ok: false, reason: 'too_large' };
    }

    const contentType = detectImageType(bytes);
    if (!contentType) {
        return { ok: false, reason: 'not_an_image' };
    }

    return { ok: true, bytes, contentType };
}
