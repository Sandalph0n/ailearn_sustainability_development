// File này lọc tham số `?next=` trước khi cho phép chuyển hướng theo nó.

/** Nơi đưa người dùng tới khi không có `next`, hoặc `next` không dùng được. */
export const DEFAULT_AUTH_REDIRECT = '/navigation/dashboard';

/**
 * Lọc `?next=` thành một đường dẫn nội bộ dùng được, hoặc trả về mặc định.
 *
 * ─── Vì sao KHÔNG được tin thẳng giá trị này ─────────────────────────────────
 *
 * `proxy.ts` gắn `?next=<đường dẫn>` khi đá người chưa đăng nhập về trang đăng nhập. Nhưng tham
 * số nằm trong URL, nghĩa là ai cũng đặt được. Chuyển hướng bừa theo nó là mở lỗ hổng open
 * redirect: kẻ tấn công gửi `/auth?next=https://tencuop.example`, nạn nhân đăng nhập xong bị đẩy
 * sang một trang giả trông y hệt, và gõ lại mật khẩu ở đó.
 *
 * Đường dẫn hợp lệ phải bắt đầu bằng ĐÚNG MỘT dấu `/`. Hai ca cần chặn:
 *
 *     //tencuop.example    URL tuyệt đối thiếu giao thức — trình duyệt vẫn đi ra ngoài
 *     /\tencuop.example    trình duyệt quy đổi `\` thành `/`, thành ra y như trên
 */
export function safeNextPath(next: string | null | undefined): string {
    if (!next || !next.startsWith('/')) {
        return DEFAULT_AUTH_REDIRECT;
    }

    const second = next[1];
    if (second === '/' || second === '\\') {
        return DEFAULT_AUTH_REDIRECT;
    }

    return next;
}

/**
 * Đọc `next` từ thanh địa chỉ hiện tại.
 *
 * Đọc từ `window` chứ không dùng `useSearchParams()` là có chủ ý: hook đó buộc component phải
 * nằm trong `<Suspense>` và kéo cả nhánh sang render phía client. Ở đây chỉ cần biết `next` vào
 * đúng lúc bấm nút, không cần nó lúc dựng giao diện.
 */
export function readNextPathFromLocation(): string {
    if (typeof window === 'undefined') {
        return DEFAULT_AUTH_REDIRECT;
    }

    return safeNextPath(new URLSearchParams(window.location.search).get('next'));
}
