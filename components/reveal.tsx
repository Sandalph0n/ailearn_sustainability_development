'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Hiện nội dung ra khi nó cuộn vào tầm nhìn.
 *
 * ─── Vì sao tự viết thay vì dùng thư viện ────────────────────────────────────
 *
 * Bản base44 dùng `framer-motion`. Dự án này không có nó, và cả trang chỉ cần đúng một hiệu ứng
 * "mờ dần rồi trượt lên". IntersectionObserver có sẵn trong trình duyệt, phần chuyển động giao
 * cho CSS — đổi lại là không thêm một phụ thuộc nào.
 *
 * ─── Vì sao `rootMargin` chứ không phải ngưỡng phần trăm ─────────────────────
 *
 * Ngưỡng kiểu "hiện 25% thì chạy" chết cứng với khối cao hơn màn hình: không bao giờ có đủ 25%
 * lọt vào khung nhìn, nên hiệu ứng không bao giờ chạy và nội dung ở mãi trạng thái ẩn. Đo theo
 * mép dưới thì cao bao nhiêu cũng đúng.
 *
 * ─── Lưu ý ──────────────────────────────────────────────────────────────────
 *
 * Máy chủ dựng ra trạng thái ẩn, nên nếu JavaScript hỏng thì nội dung không hiện. Chấp nhận được
 * với một trang giới thiệu; đừng bọc thứ gì thiết yếu bằng component này.
 */

type RevealVariant = 'up' | 'left' | 'right' | 'scale' | 'blur';

/** Điểm xuất phát của từng kiểu. Điểm kết thúc luôn giống nhau, xem `SHOWN`. */
const HIDDEN: Record<RevealVariant, string> = {
    up: 'opacity-0 translate-y-12',
    left: 'opacity-0 -translate-x-14',
    right: 'opacity-0 translate-x-14',
    scale: 'opacity-0 scale-90',
    blur: 'opacity-0 translate-y-8 blur-[10px]',
};

const SHOWN = 'opacity-100 translate-x-0 translate-y-0 scale-100 blur-0';

/**
 * Người đã tắt hiệu ứng chuyển động trong hệ điều hành thì thấy nội dung ngay, không animate.
 *
 * Xử lý bằng CSS chứ không bằng JavaScript, vì hai lý do: nó có tác dụng ngay từ lần dựng đầu
 * tiên chứ không đợi React chạy xong, và nó theo kịp nếu người dùng đổi cài đặt giữa chừng.
 *
 * Tailwind sinh các lớp có biến thể sau các lớp trơn, nên `motion-reduce:*` thắng `opacity-0`.
 */
const STILLNESS =
    'motion-reduce:opacity-100 motion-reduce:translate-x-0 motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:blur-0 motion-reduce:transition-none';

export function Reveal({
    children,
    variant = 'up',
    delay = 0,
    className,
}: {
    children: ReactNode;
    variant?: RevealVariant;
    /** Trễ tính bằng giây, để các thẻ cùng hàng hiện lần lượt chứ không cùng lúc. */
    delay?: number;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        // Trình duyệt quá cũ, không có IntersectionObserver: hiện thẳng, bỏ hiệu ứng. Hoãn sang
        // khung hình sau vì đổi state ngay trong thân effect sẽ kéo theo một lượt dựng thừa.
        if (typeof IntersectionObserver === 'undefined') {
            const frame = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(frame);
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                setShown(true);
                observer.disconnect(); // Chạy một lần; cuộn ngược lên không phát lại.
            },
            { rootMargin: '0px 0px -12% 0px' },
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            style={{ transitionDelay: `${delay}s` }}
            className={cn(
                'transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
                shown ? SHOWN : HIDDEN[variant],
                STILLNESS,
                className,
            )}
        >
            {children}
        </div>
    );
}
