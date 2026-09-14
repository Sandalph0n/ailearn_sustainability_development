import Image from 'next/image';

import { cn } from '@/lib/utils';

import logo from '@/public/brand/logo.png';

/**
 * Dấu hiệu nhận diện của Lernumi — quyển sách mở có cánh, mũi tên vàng đi lên.
 *
 * ─── Vì sao là tệp ảnh, không còn là SVG vẽ tay ──────────────────────────────
 *
 * Bản trước là một SVG viết tay trong file này: cung phát lại cộng ba cột cao dần, ăn màu từ
 * token nên tự đổi theo sáng/tối. Nay thương hiệu đã có logo thật (`logo.png` bên
 * base44), nên cái vẽ tay thành thừa — giữ hai thứ song song chỉ dẫn tới hai bộ mặt khác nhau
 * cho cùng một sản phẩm.
 *
 * Đổi lại, hình không còn ăn theo token màu nữa. Chấp nhận được vì logo tự nó đã dùng đúng
 * teal + amber của bảng màu, và nền hoàn toàn trong suốt (85% số điểm ảnh có alpha bằng 0) nên
 * đặt trên nền tối vẫn sạch, không lộ khối trắng.
 *
 * ─── Vì sao `scale-[1.65]` ───────────────────────────────────────────────────
 *
 * Ảnh gốc 1024×1024 chừa rất nhiều lề trong suốt quanh hình. Để nguyên thì logo trông bé hẳn so
 * với chữ đứng cạnh. Phóng to rồi cắt bớt bằng `overflow-hidden` ở thẻ bọc — đúng cách bản base44
 * làm — cho ra kích thước thị giác khớp với phần chữ.
 */
export function BrandLogo({
    alt = '',
    className = 'size-9',
    eager = false,
}: {
    alt?: string;
    className?: string;
    eager?: boolean;
}) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center justify-center overflow-hidden',
                className,
            )}
        >
            <Image
                src={logo}
                alt={alt}
                loading={eager ? 'eager' : 'lazy'}
                className="h-full w-full scale-[1.65] object-contain"
            />
        </span>
    );
}
