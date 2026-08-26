import { getCurrentSession } from '@/lib/auth/session/service';
import { AccountBox } from '@/components/navigation/account-box';

/**
 * Chỗ nối giữa dữ liệu và box tài khoản.
 *
 * ─── ĐÂY LÀ PHẦN LOGIC, chưa hoàn chỉnh ─────────────────────────────────────
 *
 * Hiện mới đọc phiên đăng nhập và truyền xuống. Còn thiếu hai thứ, đều thuộc phần logic:
 *
 *   1. Chốt chặn: chưa đăng nhập thì chuyển sang trang đăng nhập, thay vì trả về `null` như bây
 *      giờ. Chỗ đúng để đặt là layout của nhóm, không phải ở đây — nó phải chặn cả trang chứ
 *      không riêng cái header.
 *   2. Đăng xuất: `onSignOut` chưa nối, nên bấm vào chưa có gì xảy ra.
 *
 * Server Component nên `getCurrentSession()` đọc thẳng cookie lúc dựng trang — không có khoảnh
 * khắc nào hiện sai trạng thái rồi mới nhảy sang đúng, như khi gọi API từ trình duyệt.
 */
export async function HeaderAccount() {
    const current = await getCurrentSession();

    if (!current) {
        return null;
    }

    return <AccountBox user={current.user} />;
}
