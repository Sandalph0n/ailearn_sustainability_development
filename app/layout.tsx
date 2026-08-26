/**
 * Root layout — bọc TOÀN BỘ ứng dụng.
 *
 * Cố ý giữ ở mức tối thiểu: `<html>`, `<body>`, font, và stylesheet chung. Không header, không
 * footer, không khung. Khung là việc của từng nhóm bên dưới.
 *
 * ─── Hai nhóm bên dưới ───────────────────────────────────────────────────────
 *
 *   app/(navigation)/   trang phục vụ việc đi lại: trang chủ, đăng nhập, danh sách, lịch.
 *                       Chúng chia nhau một header/footer chung, đặt ở layout của nhóm.
 *
 *   app/(application)/  nơi làm việc thật: trình soạn mã, trình vẽ sơ đồ. CỐ Ý không có
 *                       layout — mỗi ứng dụng tự dựng lấy giao diện của mình.
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
import { Figtree, Geist_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';

// Preset Maia đi với Figtree — xem `components.json`: style `base-maia`, icon `hugeicons`.
//
// Tên biến phải đúng `--font-sans` và `--font-mono`, vì `globals.css` ánh xạ token của Tailwind
// vào chính hai tên đó. Đặt tên khác thì `font-sans` lặng lẽ rơi về mặc định trình duyệt.
const fontSans = Figtree({ variable: '--font-sans', subsets: ['latin'] });
const fontMono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'AI-Learn',
    description: 'Nền tảng học tập với công cụ làm bài tua lại được.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
    return (
        <html
            lang="vi"
            className={cn('h-full antialiased', fontSans.variable, fontMono.variable)}
        >
            <body className="min-h-full bg-background text-foreground">{children}</body>
        </html>
    );
}
