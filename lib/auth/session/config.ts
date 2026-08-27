// File này đọc cấu hình thời hạn session và định nghĩa thuộc tính bảo mật của cookie.
import 'server-only';

// Tên cookie định nghĩa ở `cookie.ts` chứ không phải ở đây, vì `proxy.ts` cũng cần nó mà file
// này có `import 'server-only'` — proxy nạp không được. Xem chú thích trong `cookie.ts`.
export { SESSION_COOKIE_NAME } from './cookie';

const DEFAULT_SESSION_TTL_DAYS = 7;
const MIN_SESSION_TTL_DAYS = 1;
const MAX_SESSION_TTL_DAYS = 90;

/**
 * Đọc thời hạn phiên từ biến môi trường, có chặn trên chặn dưới.
 *
 * Ném lỗi thay vì lặng lẽ dùng mặc định: đặt sai giá trị mà vẫn chạy thì tưởng đã cấu hình xong,
 * đến lúc phát hiện thì phiên đã sống sai hạn hàng tháng trời.
 */
function readSessionTtlDays(): number {
    const value = process.env.AUTH_SESSION_TTL_DAYS;
    if (value === undefined || value === '') {
        return DEFAULT_SESSION_TTL_DAYS;
    }

    const days = Number(value);
    if (!Number.isInteger(days) || days < MIN_SESSION_TTL_DAYS || days > MAX_SESSION_TTL_DAYS) {
        throw new Error(
            `AUTH_SESSION_TTL_DAYS must be an integer between ${MIN_SESSION_TTL_DAYS} and ${MAX_SESSION_TTL_DAYS}`,
        );
    }

    return days;
}

export function getSessionExpiresAt(now = new Date()): Date {
    const expiresAt = new Date(now);
    // Cộng theo giờ UTC để không lệch một ngày vào dịp đổi giờ mùa hè.
    expiresAt.setUTCDate(expiresAt.getUTCDate() + readSessionTtlDays());
    return expiresAt;
}

/**
 * Thuộc tính bảo mật của cookie phiên. Bốn dòng, mỗi dòng chặn một hướng tấn công.
 */
export function getSessionCookieOptions(expiresAt: Date) {
    return {
        // JavaScript không đọc được cookie này. Có lỗ hổng XSS thì kẻ tấn công vẫn không lấy
        // được token mang đi nơi khác.
        httpOnly: true,

        // Chỉ gửi qua HTTPS. Tắt ở dev vì localhost chạy HTTP thuần, bật thì cookie không bao giờ tới.
        secure: process.env.NODE_ENV === 'production',

        // Trình duyệt không đính cookie vào POST phát ra từ trang khác — một lớp chống CSRF nữa,
        // độc lập với phép kiểm origin trong `http/request.ts`. 'lax' chứ không phải 'strict' để
        // người bấm link từ email vào vẫn còn đăng nhập.
        sameSite: 'lax' as const,

        expires: expiresAt,
        path: '/',
        priority: 'high' as const,
    };
}
