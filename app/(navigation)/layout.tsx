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
 */
import { AppSidebar } from '@/components/navigation/app-sidebar';
import { HeaderAccount } from '@/components/navigation/header-account';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

export default function NavigationLayout({ children }: LayoutProps<'/'>) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />

                    {/* Đẩy mọi thứ sau nó sang phải. */}
                    <div className="flex-1" />

                    <HeaderAccount />
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
            </SidebarInset>
        </SidebarProvider>
    );
}
