import { AccountMenu } from '@/components/navigation/account-menu';
import { getCurrentSession } from '@/lib/auth/session/service';

/**
 * Chỗ nối giữa dữ liệu và box tài khoản.
 *
 * Server Component, nên `getCurrentSession()` đọc thẳng cookie lúc dựng trang — không có khoảnh
 * khắc nào hiện sai trạng thái rồi mới nhảy sang đúng, như khi gọi API từ trình duyệt.
 *
 * ─── Vì sao vẫn xử lý ca "không có phiên" ───────────────────────────────────
 *
 * `app/navigation/layout.tsx` đã chặn người chưa đăng nhập trước khi tới được đây, nên nhánh này
 * gần như không bao giờ chạy. Giữ lại vì component có thể được đặt ở chỗ khác sau này, và trả về
 * `null` thì header khuyết một góc — vẫn tốt hơn là ném lỗi.
 */
export async function HeaderAccount() {
    const current = await getCurrentSession();

    if (!current) {
        return null;
    }

    return <AccountMenu user={current.user} />;
}
