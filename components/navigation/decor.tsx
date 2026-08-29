/**
 * Các lớp trang trí dùng chung cho khu điều hướng.
 *
 * ─── Vì sao gom vào một file ─────────────────────────────────────────────────
 *
 * Ba hoạ tiết này lặp ở gần như mọi thẻ. Chép tay mỗi chỗ thì độ mờ và kích thước sẽ trôi mỗi
 * nơi một kiểu, và trang mất đi cảm giác thuộc về cùng một hệ.
 *
 * ─── Vì sao toàn bộ bằng CSS/SVG, không dùng ảnh ─────────────────────────────
 *
 * Chúng lấy màu từ token nên tự đổi theo chế độ sáng/tối, nét sắc ở mọi độ phân giải, và không
 * tốn thêm một request nào.
 *
 * Cả ba đều `aria-hidden` và `pointer-events-none`: chúng không mang thông tin và không được
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
    return (
        <div
            aria-hidden
            className={`pointer-events-none absolute rounded-full blur-3xl ${color} ${opacity} ${className}`}
        />
    );
}

/**
 * Chấm nhỏ rải rác — hoạt tiết ở tầng gần nhất.
 *
 * Vị trí là một mảng CỐ ĐỊNH, không phải `Math.random()`. Ngẫu nhiên lúc render sẽ cho ra hai
 * kết quả khác nhau giữa server và client, và React sẽ kêu hydration mismatch.
 */
const PARTICLES = [
    { left: '12%', top: '22%', size: 4, delay: '0s' },
    { left: '28%', top: '68%', size: 3, delay: '1.4s' },
    { left: '46%', top: '18%', size: 5, delay: '0.7s' },
    { left: '63%', top: '74%', size: 3, delay: '2.1s' },
    { left: '78%', top: '34%', size: 4, delay: '1.1s' },
    { left: '90%', top: '62%', size: 3, delay: '2.6s' },
] as const;

export function Particles({ className = 'text-brand-teal' }: { className?: string }) {
    return (
        <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
            {PARTICLES.map((particle) => (
                <span
                    key={particle.left}
                    className="absolute rounded-full bg-current opacity-25 motion-safe:animate-pulse motion-reduce:animate-none"
                    style={{
                        left: particle.left,
                        top: particle.top,
                        width: particle.size,
                        height: particle.size,
                        // Lệch pha nhau để chúng không nhấp nháy đồng loạt như đèn báo lỗi.
                        animationDelay: particle.delay,
                        animationDuration: '4s',
                    }}
                />
            ))}
        </div>
    );
}
