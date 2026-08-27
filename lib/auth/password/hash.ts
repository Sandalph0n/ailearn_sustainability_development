// File này băm, xác minh và nâng cấp password hash bằng Argon2id.
import 'server-only';

import * as argon2 from 'argon2';

/**
 * Tham số Argon2id, lấy theo khuyến nghị của OWASP Password Storage Cheat Sheet.
 *
 * Chọn Argon2 chứ không phải SHA-256 hay MD5 vì mục tiêu ở đây NGƯỢC với mục tiêu thường thấy:
 * ta muốn hàm băm chạy CHẬM và TỐN RAM. Hàm băm nhanh nghĩa là kẻ tấn công cầm được bảng
 * `User` có thể thử hàng tỷ mật khẩu mỗi giây trên GPU.
 *
 * `memoryCost` (KiB) là thứ chống GPU tốt nhất — GPU có nhiều nhân nhưng ít RAM cho mỗi nhân.
 *
 * Không cần tự sinh muối: `argon2.hash()` sinh muối ngẫu nhiên cho từng lần gọi và nhét luôn
 * vào chuỗi kết quả. Nên hai người cùng đặt mật khẩu `hunter2` vẫn ra hai chuỗi khác nhau.
 */
const PASSWORD_HASH_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
} as const;

/**
 * Băm của một mật khẩu không ai dùng, tạo sẵn để dùng cho nhánh "email không tồn tại".
 *
 * Không có nó thì đăng nhập bằng email lạ trả lời trong ~1ms, còn email có thật mà sai mật khẩu
 * mất ~50ms. Chênh lệch đó đo được từ ngoài, và kẻ tấn công dùng nó để dò xem những ai có tài
 * khoản ở đây — thông tin đủ để chuyển sang tấn công lừa đảo có chủ đích.
 */
const DUMMY_PASSWORD_HASH =
    '$argon2id$v=19$m=19456,p=1,t=2$hQWz1817QyOodPAr+hNqQA$asAwXTzEet2+zV/aWJVLLyOZoPjB9U+JdGzAV6DV7I4';

export function hashPassword(password: string): Promise<string> {
    return argon2.hash(password, PASSWORD_HASH_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    try {
        return await argon2.verify(passwordHash, password);
    } catch {
        // Hash hỏng hoặc sai định dạng KHÔNG được thành lỗi 500: vừa lộ chi tiết định dạng đang
        // lưu, vừa biến một dòng dữ liệu hỏng thành sự cố. Coi như mật khẩu sai là đủ.
        return false;
    }
}

/**
 * Chạy Argon2 với hash giả để nhánh "không tìm thấy user" tốn đúng ngần ấy thời gian.
 *
 * Kết quả trả về luôn là `false` và bị bỏ đi — thứ ta cần là THỜI GIAN nó tiêu tốn.
 */
export function verifyPasswordForMissingUser(password: string): Promise<boolean> {
    return verifyPassword(DUMMY_PASSWORD_HASH, password);
}

/**
 * Hash này có đang dùng tham số cũ hơn `PASSWORD_HASH_OPTIONS` không.
 *
 * Phần cứng mạnh dần nên tham số phải tăng theo. Nhưng không thể băm lại hàng loạt — server
 * không giữ mật khẩu gốc. Cách duy nhất là nâng cấp ngay lúc người đó đăng nhập, khi mật khẩu
 * vừa đi qua tay ta một lần.
 */
export function passwordHashNeedsUpgrade(passwordHash: string): boolean {
    try {
        return argon2.needsRehash(passwordHash, PASSWORD_HASH_OPTIONS);
    } catch {
        // Đọc không nổi thì coi như cần thay.
        return true;
    }
}
