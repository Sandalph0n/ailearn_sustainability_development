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
            <SidebarInset>
                <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="my-2" />
                    <span className="text-muted-foreground text-sm">Administration</span>
                    {/* Đẩy mọi thứ sau nó sang phải. */}
                    <div className="flex-1" />

                    <HeaderAccount />
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
            </SidebarInset>
        </SidebarProvider>
    );
}
