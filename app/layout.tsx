/**
 * Root layout — bọc TOÀN BỘ ứng dụng.
 *
 * Cố ý giữ ở mức tối thiểu: `<html>`, `<body>`, font, và stylesheet chung. Không header, không
 * footer, không khung. Khung là việc của từng khu vực bên dưới.
 *
 * ─── Ba khu vực bên dưới ─────────────────────────────────────────────────────
 *
 *   app/(navigation)/   trang phục vụ việc đi lại: trang chủ, danh sách, lịch. Chúng chia nhau
 *                       một sidebar chung, đặt ở layout của nhóm. Đặt trong ngoặc để trang chủ
 *                       vẫn là `/` chứ không phải `/navigation`.
 *
 *   app/tools/          route handler phục vụ gói công cụ trên origin riêng `tools.*`. Tool chạy
 *                       toàn trang, không dùng layout React hay cookie phiên của Lernumi.
 *
 *   app/auth/           đăng nhập và đăng ký. Nằm ngoài `(navigation)` vì nhóm đó được proxy
 *                       bảo vệ — để ở trong thì người chưa đăng nhập bị đá về chính nó.
 *
 * Thư mục đặt trong ngoặc không xuất hiện trong URL, nên `(navigation)/page.tsx` vẫn là `/`.
 *
 * ─── Vì sao root layout nằm ở ĐÂY chứ không phải mỗi nhóm một cái ────────────
 *
 * Cách kia cũng chạy: bỏ file này đi thì layout của mỗi nhóm tự thành root. Nhưng khi đó cả hai
 * đều phải tự khai `<html>`, `<body>`, font và stylesheet — hai bản sao rồi sẽ lệch nhau.
 *
 * Và Next tải lại TOÀN TRANG khi đi giữa hai root layout khác nhau. Chung một root thì việc từ
 * danh sách bước vào một công cụ vẫn là điều hướng phía client.
 */
import type { Metadata } from 'next';
import { Figtree, IBM_Plex_Mono } from 'next/font/google';
import { Toaster } from 'sonner';

import { ThemeProvider, THEME_INIT_SCRIPT } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import './globals.css';

// Preset Maia đi với Figtree — xem `components.json`: style `base-maia`, icon `hugeicons`.
//
// Tên biến phải đúng `--font-sans` và `--font-mono`, vì `globals.css` ánh xạ token của Tailwind
// vào chính hai tên đó. Đặt tên khác thì `font-sans` lặng lẽ rơi về mặc định trình duyệt.
const fontSans = Figtree({ variable: '--font-sans', subsets: ['latin'] });
// IBM Plex Mono chứ không phải Geist Mono: Geist nằm trong nhóm font mặc định người ta với lấy
// theo quán tính, nên nó đọc như "chưa ai chọn gì". Plex Mono có tính cách riêng, và với một sản
// phẩm mà công cụ chính là trình soạn mã thì mặt chữ máy đánh chữ là một lựa chọn có lý do.
const fontMono = IBM_Plex_Mono({
    variable: '--font-mono',
    subsets: ['latin'],
    weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
    title: 'Lernumi',
    description: 'A learning platform whose tools record how the work happened.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
    return (
        <html
            lang="en"
            className={cn('h-full antialiased', fontSans.variable, fontMono.variable)}
            // Script dưới đây sửa `class` và `style` của chính thẻ này trước khi React ngậm nước.
            // Không có cờ này thì React coi đó là lệch trạng thái và dựng lại từ đầu, xoá mất việc
            // script vừa làm — tức là lại nháy sáng.
            suppressHydrationWarning
        >
            <head>
                {/* Phải nằm trong `<head>` và chạy đồng bộ, trước khung hình đầu tiên. */}
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
            </head>
            <body className="min-h-full bg-background text-foreground">
                <ThemeProvider>
                    {children}
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
