import Link from 'next/link';

import { BrandLogo } from '@/components/brand-logo';
import { ThemeMenu } from '@/components/theme-menu';
import { buttonVariants } from '@/components/ui/button';

/**
 * Đầu trang của About.
 *
 * Khác đầu trang giới thiệu ở hai điểm, giữ đúng như bản base44: nó `sticky` chứ không `fixed`
 * (About không có hero tràn lên dưới đầu trang nên không cần chừa chỗ), và thay mục lục cuộn tới
 * bằng một nút quay về trang giới thiệu.
 */
export function AboutHeader() {
    return (
        <header className="bg-background/90 border-border/60 sticky top-0 z-50 border-b backdrop-blur">
            <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
                <Link href="/" className="flex items-center gap-3">
                    <BrandLogo className="size-10" eager />
                    <span className="font-heading text-xl font-semibold tracking-tight">
                        Lern<span className="text-brand-teal">umi</span>
                    </span>
                </Link>

                <div className="flex items-center gap-2">
                    <ThemeMenu />
                    <Link
                        href="/"
                        className={buttonVariants({
                            variant: 'ghost',
                            size: 'lg',
                            className: 'hidden sm:inline-flex',
                        })}
                    >
                        Home
                    </Link>
                    <Link href="/auth" className={buttonVariants({ size: 'lg' })}>
                        Start learning
                    </Link>
                </div>
            </div>
        </header>
    );
}
