/**
 * Dấu hiệu nhận diện của Lernumi.
 *
 * Hai ý gộp trong một hình: cung tròn có mũi tên quay lại là **phát lại**, ba cột cao dần là
 * **tiến bộ nhìn thấy được**. Đó đúng là hai thứ nền tảng mà sản phẩm bán.
 *
 * ─── Vì sao là SVG viết tay, không phải tệp ảnh ──────────────────────────────
 *
 * Nó lấy màu từ token nên tự đổi theo chế độ sáng/tối, nét luôn sắc ở mọi kích thước, và không
 * tốn thêm một request nào.
 *
 * Bản base44 viết `hsl(var(--brand-teal))` vì bên đó token là ba số HSL rời. Token của ta đã là
 * màu hoàn chỉnh, nên dùng thẳng `var(--brand-teal)` — bọc `hsl()` vào là hỏng.
 */
export function BrandLogo({
    className = 'size-9',
    /**
     * `<defs>` dùng id toàn cục cho cả tài liệu. Trang này vẽ logo ở cả đầu trang lẫn chân trang,
     * nên cần id khác nhau — trùng id thì instance sau lấy nhầm gradient của instance trước.
     */
    gradientId = 'lernumi-mark',
}: {
    className?: string;
    gradientId?: string;
}) {
    return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--brand-teal)" />
                    <stop offset="55%" stopColor="var(--brand-sky)" />
                    <stop offset="100%" stopColor="var(--brand-violet)" />
                </linearGradient>
            </defs>

            <rect x="1" y="1" width="38" height="38" rx="11" fill={`url(#${gradientId})`} />

            {/* Cung phát lại — đường đi của một bài làm, ghi lại được. */}
            <path
                d="M11 26.5a10 10 0 1 1 17.4-6.5"
                fill="none"
                stroke="var(--primary-foreground)"
                strokeOpacity="0.55"
                strokeWidth="2.4"
                strokeLinecap="round"
            />
            <path
                d="M28.4 13.6v6.6h-6.6"
                fill="none"
                stroke="var(--primary-foreground)"
                strokeOpacity="0.55"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Ba cột cao dần — tiến bộ nhìn thấy được. */}
            <rect x="13" y="24" width="3.6" height="5" rx="1.2" fill="var(--primary-foreground)" />
            <rect
                x="18.2"
                y="20.5"
                width="3.6"
                height="8.5"
                rx="1.2"
                fill="var(--primary-foreground)"
            />
            <rect
                x="23.4"
                y="16.5"
                width="3.6"
                height="12.5"
                rx="1.2"
                fill="var(--primary-foreground)"
            />
        </svg>
    );
}
