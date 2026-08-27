/**
 * Khung chung cho các trang ĐIỀU HƯỚNG: trang chủ, môn học, bài tập, lịch.
 *
 * Sidebar bên trái chỉ để ĐIỀU HƯỚNG. Tài khoản nằm ở góc phải header — xem `HeaderAccount`.
 *
 * ─── Vì sao khung nằm ở layout chứ không ở từng trang ────────────────────────
 *
 * Next giữ nguyên layout khi chuyển giữa các trang cùng nhóm, nên sidebar không bị dựng lại,
 * không chớp, không mất trạng thái đóng/mở. Đặt ở từng trang thì mỗi lần điều hướng là một lần
 * dựng lại từ đầu.
 *
 * `app/tools/` cố ý KHÔNG có layout, nên công cụ chiếm trọn màn hình, không kèm sidebar.
 *
 * ─── ĐÂY LÀ CHỐT CHẶN THẬT ───────────────────────────────────────────────────
 *
 * `proxy.ts` cũng đá người chưa đăng nhập về `/auth`, nhưng nó chỉ trả lời được "có cookie phiên
 * không" — cookie giả, hết hạn, hoặc thuộc phiên đã thu hồi đều lọt qua đó. Nó chạy trên mọi
 * request kể cả những request Next tự nạp trước, nên không được phép đụng database.
 *
 * Chốt chặn ở đây băm token rồi tra bảng `LoginSession` kèm điều kiện còn hạn. Đặt ở layout chứ
 * không ở từng trang: thêm trang mới dưới `/navigation/` là tự động được bảo vệ, không phải nhớ
 * chép lại đoạn kiểm tra.
 */
import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/navigation/app-sidebar';
import { HeaderAccount } from '@/components/navigation/header-account';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { getCurrentSession } from '@/lib/auth/session/service';

export default async function NavigationLayout({ children }: LayoutProps<'/navigation'>) {
    const session = await getCurrentSession();
    if (!session) {
        // Không gắn `?next=` ở đây: layout không biết người dùng đang đứng ở đường dẫn nào — nó
        // chỉ nhận `children`. Việc ghi nhớ đích đến là của `proxy.ts`, nơi có `request.nextUrl`.
        redirect('/auth');
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="my-2"/>
                    {/* Đẩy mọi thứ sau nó sang phải. */}
                    <div className="flex-1" />

                    <HeaderAccount />
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
            </SidebarInset>
        </SidebarProvider>
    );
}
