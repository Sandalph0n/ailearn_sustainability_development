/**
 * Các lớp trang trí dùng chung cho khu điều hướng.
 *
 * ─── Vì sao gom vào một file ─────────────────────────────────────────────────
 *
 * Hai hoạ tiết này lặp ở gần như mọi thẻ. Chép tay mỗi chỗ thì độ mờ và kích thước sẽ trôi mỗi
 * nơi một kiểu, và trang mất đi cảm giác thuộc về cùng một hệ.
 *
 * ─── Vì sao toàn bộ bằng CSS/SVG, không dùng ảnh ─────────────────────────────
 *
 * Chúng lấy màu từ token nên tự đổi theo chế độ sáng/tối, nét sắc ở mọi độ phân giải, và không
 * tốn thêm một request nào.
 *
 * Cả hai đều `aria-hidden` và `pointer-events-none`: chúng không mang thông tin và không được
 * chắn chuột.
 */

/** Lưới chấm mờ. Cùng thủ pháp với trang giới thiệu và trang đăng nhập. */
export function DotGrid({
    className = '',
    opacity = 0.05,
    size = 20,
}: {
    className?: string;
    opacity?: number;
    size?: number;
}) {
    return (
        <div
            aria-hidden
            className={`text-foreground pointer-events-none absolute inset-0 ${className}`}
            style={{
                opacity,
                backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
                backgroundSize: `${size}px ${size}px`,
            }}
        />
    );
}

/**
 * Quầng sáng mờ — "particle" cỡ lớn.
 *
 * `blur-3xl` biến một hình tròn đặc thành vùng sáng loang. Đặt lệch ra ngoài mép thẻ rồi để
 * `overflow-hidden` của thẻ cắt đi, nên nó trông như ánh sáng hắt vào chứ không phải một hình vẽ.
 */
export function Glow({
    className,
    color = 'bg-brand-teal',
    opacity = 'opacity-20',
}: {
    className: string;
    color?: string;
    opacity?: string;
}) {
    // `rounded-full` ở đây là một HÌNH TRÒN thật, không phải hộp bo góc — nên nó không thuộc
    // dấu hiệu "bo tròn mọi thứ". Đánh dấu để lần quét sau không hỏi lại.
    const classes = `pointer-events-none absolute rounded-full blur-3xl ${color} ${opacity} ${className}`; // unslop-ignore

    return <div aria-hidden className={classes} />;
}
