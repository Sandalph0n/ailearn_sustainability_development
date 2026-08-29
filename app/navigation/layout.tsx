/**
 * Khung chung cho các trang ĐIỀU HƯỚNG: bảng điều khiển, môn học, bài tập, lịch.
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
 * ─── Vì sao `variant="inset"` ────────────────────────────────────────────────
 *
 * Nó đổi hẳn bố cục: nền của cả trang thành `--sidebar` (teal đậm), còn phần nội dung co lại
 * thành một tấm thẻ bo góc, có bóng, nổi lên trên. Sidebar không còn là một cột dán mép màn hình
 * mà là mảng màu phía sau.
 *
 * Cách này hợp với bảng màu đang có: teal đậm làm nền, trắng làm mặt giấy, và màu thương hiệu
 * dành riêng cho những chỗ cần nhấn bên trong nội dung.
 */
import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/navigation/app-sidebar';
import { HeaderAccount } from '@/components/navigation/header-account';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { getCurrentSession } from '@/lib/auth/session/service';

/**
 * ─── ĐÂY LÀ CHỐT CHẶN THẬT ───────────────────────────────────────────────────
 *
 * `proxy.ts` cũng đá người chưa đăng nhập về `/auth`, nhưng nó chỉ trả lời được "có cookie phiên
 * không" — cookie giả, hết hạn, hoặc thuộc phiên đã thu hồi đều lọt qua đó. Nó chạy trên mọi
 * request kể cả những request Next tự nạp trước, nên không được phép đụng database.
 *
 * Chốt chặn ở đây băm token rồi tra bảng `LoginSession` kèm điều kiện còn hạn. Đặt ở layout chứ
 * không ở từng trang: thêm trang mới dưới `/navigation/` là tự động được bảo vệ.
 */
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

            <SidebarInset className="overflow-hidden">
                {/*
                    Header trong suốt, không viền — tấm thẻ nội dung đã tự tách khỏi nền teal rồi,
                    thêm một đường kẻ nữa là chia đôi thứ vốn liền mạch.
                */}
                <header className="flex h-16 shrink-0 items-center gap-3 px-5 md:px-6">
                    <SidebarTrigger className="-ml-1.5" />
                    <div className="flex-1" />
                    <HeaderAccount />
                </header>

                {/*
                    Lưới chấm rất mờ, cùng thủ pháp với trang giới thiệu và trang đăng nhập. Nó
                    giữ cho vùng nội dung không phẳng lì mà không tranh chỗ với dữ liệu thật.
                */}
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
