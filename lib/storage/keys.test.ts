import { describe, expect, it } from 'vitest';

import { isMediaKey, newAvatarKey, newLogoKey } from './keys';

const USER_ID = '9f3a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b';

describe('media keys', () => {
    it('gives every upload a different key so caches invalidate themselves', () => {
        expect(newAvatarKey(USER_ID)).not.toBe(newAvatarKey(USER_ID));
    });

    it('accepts the keys it generates', () => {
        expect(isMediaKey(newAvatarKey(USER_ID))).toBe(true);
        expect(isMediaKey(newLogoKey(USER_ID))).toBe(true);
    });

    // Route phục vụ ảnh nhận khoá từ URL. Mỗi dòng dưới đây là một đường mà kẻ tấn công sẽ thử.
    it.each([
        ['đường dẫn leo ngược', 'avatar/../../etc/passwd'],
        ['tiền tố lạ', `secret/${USER_ID}/0011223344556677`],
        ['thiếu hậu tố', `avatar/${USER_ID}`],
        ['hậu tố sai bảng chữ cái', `avatar/${USER_ID}/../../secret`],
        ['thừa đoạn phía sau', `avatar/${USER_ID}/0011223344556677/extra`],
        ['rỗng', ''],
    ])('rejects %s', (_label, key) => {
        expect(isMediaKey(key)).toBe(false);
    });
});
