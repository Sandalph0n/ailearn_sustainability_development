'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AccountBox, type AccountUser } from '@/components/navigation/account-box';
import { AvatarDialog } from '@/components/navigation/avatar-dialog';

/**
 * Nối `AccountBox` với API đăng xuất.
 *
 * ─── Vì sao tách khỏi `AccountBox` ───────────────────────────────────────────
 *
 * `AccountBox` cố ý thuần trình bày: nhận `user` qua props, không gọi API, không đọc phiên. Nhờ
 * vậy nó dùng lại và thử được ở bất kỳ đâu mà không cần database. Phần biết tới `fetch` và điều
 * hướng nằm ở đây.
 *
 * ─── Vì sao đây là Client Component ──────────────────────────────────────────
 *
 * `HeaderAccount` là Server Component nên đọc được cookie lúc dựng trang, nhưng hàm không đi qua
 * ranh giới server → client được. Cần một lớp mỏng phía client để cầm sự kiện bấm nút.
 */
export function AccountMenu({ user }: { user: AccountUser }) {
    const router = useRouter();
    const [signingOut, setSigningOut] = useState(false);

    async function signOut() {
        // Chặn bấm nhiều lần: lần thứ hai gửi khi cookie đã bị xoá sẽ chẳng làm gì, nhưng vẫn
        // tốn một vòng và làm giao diện nhấp nháy.
        if (signingOut) return;
        setSigningOut(true);

        try {
            // Không cần gửi body. Route chỉ đọc cookie để biết thu hồi phiên nào.
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            // Mạng hỏng. Vẫn đưa người dùng về trang đăng nhập: phiên có thể đã bị thu hồi ở
            // server rồi, và giữ họ lại trong ứng dụng với trạng thái mập mờ thì tệ hơn.
        }

        router.push('/auth');
        // Cookie vừa bị xoá, nhưng Next còn giữ cây server component dựng lúc đang đăng nhập.
        // Thiếu `refresh()` thì bấm nút Quay lại là thấy giao diện của người đã đăng nhập.
        router.refresh();
    }

    const initials = `${user.firstName.at(0) ?? ''}${user.lastName.at(0) ?? ''}`.toUpperCase();

    return (
        <AccountBox
            user={user}
            onSignOut={signOut}
            pictureItem={<AvatarDialog initials={initials} avatarKey={user.avatarKey} />}
        />
    );
}
