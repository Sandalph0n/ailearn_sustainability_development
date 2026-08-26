/**
 * Khung chung cho các trang ĐIỀU HƯỚNG: trang chủ, đăng nhập, danh sách môn, lịch.
 *
 * Header và footer dùng chung sẽ đặt ở đây. Hiện mới có phần dựng cột dọc để trang con giãn hết
 * chiều cao — thứ mà `app/layout.tsx` cố ý không làm, vì root phải trung lập với cả hai nhóm.
 */
export default function NavigationLayout({ children }: LayoutProps<'/'>) {
    return (
    <div className="flex min-h-screen flex-col">
        {children}
    </div>);
}
