// File này sinh session token ngẫu nhiên và băm token trước khi lưu vào database.
import { createHash, randomBytes } from 'node:crypto';

/**
 * 32 byte = 256 bit entropy. Đoán mò là bất khả thi, không cần thêm.
 *
 * `randomBytes` là nguồn ngẫu nhiên của hệ điều hành, KHÔNG phải `Math.random()`. `Math.random()`
 * dự đoán được nếu biết đủ giá trị trước đó — dùng nó ở đây là tự mở cửa.
 */
const SESSION_TOKEN_BYTES = 32;

export function generateSessionToken(): string {
    // base64url thay vì base64: không có `+`, `/`, `=` nên đặt vào cookie hay URL đều an toàn.
    return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

/**
 * Băm token trước khi ghi xuống database.
 *
 * Database lưu BĂM, cookie giữ token gốc. Rò bảng `LoginSession` thì kẻ tấn công cầm được một
 * đống chuỗi băm và không mạo danh được ai — hệt như lý do ta không lưu mật khẩu dạng gốc.
 *
 * Ở đây dùng SHA-256 chứ không phải Argon2, và đó là chủ ý: token vốn đã là 256 bit ngẫu nhiên,
 * không có gì để "dò" nên không cần hàm băm chậm. Mà token thì phải tra ở MỌI request — chậm
 * 50ms mỗi lần là không chấp nhận được.
 */
export function hashSessionToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}
