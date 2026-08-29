/**
 * Khung chung cho khu QUẢN TRỊ.
 *
 * Cùng hình dạng với `app/navigation/layout.tsx` — sidebar trái, header có tài khoản ở góc phải —
 * nhưng sidebar liệt kê mục quản trị và có thêm một chốt chặn nữa.
 *
 * ─── Hai chốt chặn, không phải một ───────────────────────────────────────────
 *
 * 1. `session` rỗng  → chưa đăng nhập     → về `/auth`
 * 2. `isSystemAdmin` sai → đã đăng nhập nhưng không có quyền → về `/navigation/dashboard`
 *
 * Hai nhánh đi hai nơi khác nhau là có chủ ý. Đá người đã đăng nhập về `/auth` sẽ khiến họ tưởng
 * phiên hỏng rồi đăng nhập lại vô ích.
 *
 * ─── Vì sao KHÔNG trả 404 để giấu sự tồn tại của khu này ─────────────────────
 *
 * Giấu đường dẫn không phải là biện pháp bảo vệ — chốt chặn thật nằm ở dòng kiểm bên dưới, và ở
 * từng route API. `/admin` là đường dẫn đoán được trong mọi ứng dụng; vờ như nó không tồn tại chỉ
 * làm người dùng hợp lệ bối rối chứ không cản được ai.
 *
 * ─── Đây là chốt chặn CỦA GIAO DIỆN, không phải của dữ liệu ──────────────────
 *
 * Nó ngăn khu quản trị hiện ra. Nó KHÔNG bảo vệ dữ liệu: mỗi route API dưới `/api/admin/` vẫn
 * phải tự kiểm quyền, vì ai cũng gọi thẳng vào đó được mà không đi qua trang nào.
 */
import { redirect } from 'next/navigation';

import { AdminSidebar } from '@/components/admin/admin-sidebar';
import {
    JOIN_REQUEST_ICON,
    NotificationsProvider,
    NotificationsTrigger,
    type AdminNotification,
} from '@/components/admin/notifications-sidebar';
import { HeaderAccount } from '@/components/navigation/header-account';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';

/**
 * ─── Vì sao thông báo nằm ở LAYOUT, không phải một trang ─────────────────────
 *
 * Nó là sidebar thứ hai, nên nó phải có mặt ở mọi trang quản trị và giữ nguyên khi chuyển trang.
 * Đặt trong một trang thì mỗi lần điều hướng là một lần dựng lại, và trạng thái đóng/mở mất.
 *
 * Kéo theo một hệ quả về phạm vi: nguồn thông báo phải là TOÀN HỆ THỐNG, không riêng một cơ sở.
 * Bản trước tôi đặt nó trong trang chi tiết Institution nên nó chỉ đếm đơn của trường đó.
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
    const session = await getCurrentSession();

    if (!session) {
        redirect('/auth');
    }

    if (!session.user.isSystemAdmin) {
        redirect('/navigation/dashboard');
    }

    /**
     * Hiện chỉ có MỘT nguồn thật.
     *
     * Chưa có bảng `Notification`, chưa có hàng đợi. Thứ duy nhất đã tồn tại và thật sự cần
     * người quản trị quyết là đơn xin vai trò đang chờ.
     *
     * Không bịa thêm mục cho cột trông đầy — đến lúc nối nguồn thật sẽ phải gỡ, và trong lúc đó
     * không ai phân biệt được cái nào thật.
     */
    const pendingRequests = await db.roleRequest.count({ where: { status: 'PENDING' } });

    const notifications: AdminNotification[] =
        pendingRequests > 0
            ? [
                  {
                      id: 'join-requests',
                      icon: JOIN_REQUEST_ICON,
                      title: `${pendingRequests} join request${pendingRequests === 1 ? '' : 's'}`,
                      body: 'People are waiting for a role. Approve or reject them.',
                      at: 'Waiting for a decision',
                      tone: 'attention',
                  },
              ]
            : [];

    return (
        <SidebarProvider>
            <AdminSidebar />
            <SidebarInset className="overflow-hidden">
                <NotificationsProvider notifications={notifications}>
                    <header className="bg-background sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b px-5 md:px-6">
                        <SidebarTrigger className="-ml-1.5" />
                        <Separator
                            orientation="vertical"
                            className="h-5 data-vertical:self-center"
                        />
                        {/* Nhãn cảnh báo: mọi thay đổi ở khu này ảnh hưởng toàn hệ thống. */}
                        <span className="text-destructive bg-destructive/10 rounded-sm px-2 py-0.5 text-xs font-semibold tracking-wide uppercase">
                            Administration
                        </span>
                        <div className="flex-1" />
                        <HeaderAccount />
                        <NotificationsTrigger />
                    </header>

                    <div className="relative flex-1 overflow-y-auto">
                        <div
                            aria-hidden
                            className="text-foreground pointer-events-none absolute inset-0 opacity-[0.035]"
                            style={{
                                backgroundImage:
                                    'radial-gradient(currentColor 1px, transparent 1px)',
                                backgroundSize: '22px 22px',
                            }}
                        />
                        <div className="relative px-5 pb-10 md:px-6">{children}</div>
                    </div>
                </NotificationsProvider>
            </SidebarInset>
        </SidebarProvider>
    );
}
