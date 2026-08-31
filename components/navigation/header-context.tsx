import { Suspense } from 'react';

import { ContextSwitcher } from '@/components/navigation/context-switcher';
import { listContextOptions } from '@/lib/context/active-context';
import { getCurrentSession } from '@/lib/auth/session/service';

/**
 * Chỗ nối giữa database và bộ chọn vai trò. Cùng lối với `HeaderAccount`.
 *
 * ─── Vì sao có `Suspense` ────────────────────────────────────────────────────
 *
 * `ContextSwitcher` gọi `useSearchParams()`. Next bắt buộc mọi component đọc query string phải
 * nằm dưới một ranh giới Suspense, vì query string chỉ biết được lúc có request thật — không có
 * ranh giới thì cả cây bị kéo ra khỏi phần dựng sẵn được.
 *
 * Phần dự phòng giữ đúng chiều cao nút thật để header không giật một nhịp khi nội dung tới.
 */
export async function HeaderContext() {
    const current = await getCurrentSession();

    if (!current) {
        return null;
    }

    const options = await listContextOptions(current.user.id);

    return (
        <Suspense fallback={<div className="h-11 w-48" />}>
            <ContextSwitcher options={options} />
        </Suspense>
    );
}
