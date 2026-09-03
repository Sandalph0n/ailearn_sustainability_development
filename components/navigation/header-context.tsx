import { Suspense } from 'react';

import { ContextSwitcher } from '@/components/navigation/context-switcher';
import type { ContextOption } from '@/lib/context/context-params';

/**
 * Chỗ nối giữa danh sách context mà layout đã nạp và bộ chọn vai trò.
 *
 * ─── Vì sao có `Suspense` ────────────────────────────────────────────────────
 *
 * `ContextSwitcher` gọi `useSearchParams()`. Next bắt buộc mọi component đọc query string phải
 * nằm dưới một ranh giới Suspense, vì query string chỉ biết được lúc có request thật — không có
 * ranh giới thì cả cây bị kéo ra khỏi phần dựng sẵn được.
 *
 * Phần dự phòng giữ đúng chiều cao nút thật để header không giật một nhịp khi nội dung tới.
 */
export function HeaderContext({ options }: { options: ContextOption[] }) {
    return (
        <Suspense fallback={<div className="h-11 w-48" />}>
            <ContextSwitcher options={options} />
        </Suspense>
    );
}
