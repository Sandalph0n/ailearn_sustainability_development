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
    SUBJECT_ACCESS_REQUEST_ICON,
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

    const [pendingRoleRequests, pendingScopeRequests] = await Promise.all([
        db.roleRequest.findMany({
            where: { status: 'PENDING' },
            orderBy: { institution: { name: 'asc' } },
            select: { institution: { select: { id: true, name: true } } },
        }),
        db.scopeAssignmentRequest.findMany({
            where: { status: 'PENDING' },
            orderBy: { offering: { subject: { institution: { name: 'asc' } } } },
            select: {
                offering: {
                    select: {
                        subject: {
                            select: { institution: { select: { id: true, name: true } } },
                        },
                    },
                },
            },
        }),
    ]);

    function groupInstitutions(rows: Array<{ id: string; name: string }>) {
        const grouped = new Map<string, { name: string; count: number }>();
        for (const institution of rows) {
            const current = grouped.get(institution.id);
            grouped.set(institution.id, {
                name: institution.name,
                count: (current?.count ?? 0) + 1,
            });
        }
        return grouped;
    }

    const roleRequestsByInstitution = groupInstitutions(
        pendingRoleRequests.map((request) => request.institution),
    );
    const scopeRequestsByInstitution = groupInstitutions(
        pendingScopeRequests.map((request) => request.offering.subject.institution),
    );

    const notifications: AdminNotification[] = [
        ...Array.from(roleRequestsByInstitution, ([id, item]) => ({
            id: `role-requests-${id}`,
            icon: JOIN_REQUEST_ICON,
            title: `${item.count} role request${item.count === 1 ? '' : 's'}`,
            body: item.name,
            at: 'Waiting for a decision',
            tone: 'attention' as const,
            href: `/admin/institutions/${id}/requests?kind=role`,
        })),
        ...Array.from(scopeRequestsByInstitution, ([id, item]) => ({
            id: `scope-requests-${id}`,
            icon: SUBJECT_ACCESS_REQUEST_ICON,
            title: `${item.count} subject access request${item.count === 1 ? '' : 's'}`,
            body: item.name,
            at: 'Waiting for a decision',
            tone: 'attention' as const,
            href: `/admin/institutions/${id}/requests?kind=scope`,
        })),
    ];

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
