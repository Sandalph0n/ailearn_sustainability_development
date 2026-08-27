'use client';

/**
 * Thông báo lỗi ở mức BIỂU MẪU, cho những lỗi không thuộc riêng ô nào.
 *
 * Ví dụ "Email or password is incorrect": server cố ý không nói ô nào sai, vì tách ra thành
 * "email không tồn tại" với "mật khẩu sai" là biếu cho kẻ tấn công một công cụ dò tài khoản.
 *
 * `role="alert"` để trình đọc màn hình đọc lên ngay khi nó xuất hiện — người không nhìn thấy
 * màn hình vẫn biết vì sao bấm nút mà không có gì xảy ra.
 */
export function FormAlert({ message }: { message?: string }) {
    if (!message) return null;

    return (
        <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
            {message}
        </div>
    );
}
