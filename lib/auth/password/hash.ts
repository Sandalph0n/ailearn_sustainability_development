// File này băm, xác minh và nâng cấp password hash bằng Argon2id.
import 'server-only';

import * as argon2 from 'argon2';

const PASSWORD_HASH_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
} as const;

// Dùng khi email không tồn tại để nhánh đăng nhập sai vẫn chạy Argon2, tránh làm lộ email qua thời gian phản hồi.
const DUMMY_PASSWORD_HASH =
    '$argon2id$v=19$m=19456,p=1,t=2$hQWz1817QyOodPAr+hNqQA$asAwXTzEet2+zV/aWJVLLyOZoPjB9U+JdGzAV6DV7I4';

export function hashPassword(password: string): Promise<string> {
    return argon2.hash(password, PASSWORD_HASH_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    try {
        return await argon2.verify(passwordHash, password);
    } catch {
        // Hash cũ/hỏng không được biến thành lỗi 500 hoặc làm lộ chi tiết định dạng đang lưu.
        return false;
    }
}

export function verifyPasswordForMissingUser(password: string): Promise<boolean> {
    return verifyPassword(DUMMY_PASSWORD_HASH, password);
}

export function passwordHashNeedsUpgrade(passwordHash: string): boolean {
    try {
        return argon2.needsRehash(passwordHash, PASSWORD_HASH_OPTIONS);
    } catch {
        return true;
    }
}
