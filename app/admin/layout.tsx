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
import { HeaderAccount } from '@/components/navigation/header-account';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { getCurrentSession } from '@/lib/auth/session/service';

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
    const session = await getCurrentSession();

    if (!session) {
        redirect('/auth');
    }

    if (!session.user.isSystemAdmin) {
        redirect('/navigation/dashboard');
    }

    return (
        <SidebarProvider>
            <AdminSidebar />
            <SidebarInset className="overflow-hidden">
                <header className="flex h-16 shrink-0 items-center gap-3 px-5 md:px-6">
                    <SidebarTrigger className="-ml-1.5" />
                    <Separator orientation="vertical" className="h-5 data-vertical:self-center" />
                    {/* Nhãn cảnh báo: mọi thay đổi ở khu này ảnh hưởng toàn hệ thống. */}
                    <span className="text-destructive bg-destructive/10 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        Administration
                    </span>
                    <div className="flex-1" />
                    <HeaderAccount />
                </header>

                <div className="relative flex-1 overflow-y-auto">
                    <div
                        aria-hidden
                        className="text-foreground pointer-events-none absolute inset-0 opacity-[0.035]"
                        style={{
                            backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
                            backgroundSize: '22px 22px',
                        }}
                    />
                    <div className="relative px-5 pb-10 md:px-6">{children}</div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
