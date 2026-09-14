import Link from 'next/link';

import { BrandLogo } from '@/components/brand-logo';

/**
 * Chân trang dùng chung cho các trang công khai — giới thiệu, About, và sau này là điều khoản.
 *
 * ─── Vì sao tách ra thành component ──────────────────────────────────────────
 *
 * Bản base44 để nó trong `components/home/` rồi gọi từ cả `Home` lẫn `About`. Giữ nguyên cách đó:
 * hai trang này không chia nhau layout nào (mỗi trang tự dựng đầu trang riêng, xem `about-header`),
 * nên chân trang là thứ duy nhất chúng thật sự dùng chung.
 *
 * ─── Vì sao không phải một layout ────────────────────────────────────────────
 *
 * Nhóm `(public)` với layout chung cũng chạy, nhưng đầu trang hai bên khác nhau — trang giới thiệu
 * dính cứng (`fixed`) và có mục lục cuộn tới, About thì `sticky` và chỉ có hai nút. Gom vào một
 * layout sẽ phải truyền cờ để bật tắt từng phần, rườm rà hơn là gọi thẳng.
 */

const LINKS = [
    { href: '/about', label: 'About' },
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
] as const;

export function SiteFooter() {
    return (
        <footer className="border-border bg-card border-t">
            <div className="mx-auto max-w-7xl px-5 py-10 text-center md:px-8">
                <nav
                    aria-label="Footer navigation"
                    className="mb-6 flex flex-wrap justify-center gap-x-8 gap-y-3"
                >
                    {LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/*
                    Bản base44 chỉ có một dòng bản quyền. Giữ lại dấu hiệu nhận diện ở đây vì trang
                    giới thiệu trước đó đã có, và bỏ đi thì chân trang mất hẳn mỏ neo thị giác.
                */}
                <div className="text-muted-foreground flex flex-col items-center gap-3 text-sm">
                    <BrandLogo className="size-7" alt="Lernumi" />
                    <p>© 2026 Lernumi. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}
