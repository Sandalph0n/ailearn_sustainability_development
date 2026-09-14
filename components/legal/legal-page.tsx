import { ArrowLeft02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { BrandLogo } from '@/components/brand-logo';

/**
 * Khung dùng chung cho các trang văn bản pháp lý.
 *
 * ─── Vì sao là component nhận dữ liệu, không phải hai trang viết tay ─────────
 *
 * Chính sách riêng tư và điều khoản dịch vụ có cùng một hình dạng: nhãn ngày cập nhật, tiêu đề,
 * đoạn dẫn, rồi một danh sách mục đánh số. Khác nhau chỉ ở chữ. Tách khung ra thì mỗi trang chỉ
 * còn là một mảng dữ liệu, và sửa bố cục một lần là cả hai cùng đổi.
 *
 * ─── Vì sao không có chân trang ──────────────────────────────────────────────
 *
 * Giữ nguyên như bản base44: hai trang này là ngõ cụt, đọc xong thì quay về. Một chân trang lại
 * trỏ ngược sang trang kia chỉ khiến người ta đi vòng.
 */

export type LegalSection = { title: string; body: string };

export function LegalPage({
    title,
    intro,
    sections,
}: {
    title: string;
    intro: string;
    sections: readonly LegalSection[];
}) {
    return (
        <div className="bg-background text-foreground min-h-svh">
            <header className="border-border bg-card border-b">
                <div className="mx-auto flex h-20 max-w-225 items-center justify-between px-5 md:px-8">
                    <Link href="/" className="flex items-center gap-3">
                        <BrandLogo className="size-9" />
                        <span className="font-heading text-xl font-semibold">
                            AI-<span className="text-brand-teal">Learn</span>
                        </span>
                    </Link>

                    <Link
                        href="/"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                        <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
                        Back to home
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-190 px-5 py-14 md:px-8 md:py-20">
                <p className="text-brand-teal mb-3 text-sm font-medium">
                    Last updated 31 August 2026
                </p>
                <h1 className="font-heading mb-5 text-4xl font-bold tracking-tight md:text-5xl">
                    {title}
                </h1>
                <p className="text-muted-foreground mb-12 text-lg leading-relaxed">{intro}</p>

                <div className="border-border border-t">
                    {sections.map((section, index) => (
                        <section
                            key={section.title}
                            className="border-border grid gap-3 border-b py-8 md:grid-cols-[56px_1fr] md:gap-6"
                        >
                            <span className="text-brand-teal text-sm font-semibold tracking-wide">
                                {String(index + 1).padStart(2, '0')}
                            </span>
                            <div>
                                <h2 className="font-heading mb-3 text-xl font-semibold">
                                    {index + 1}. {section.title}
                                </h2>
                                <p className="text-muted-foreground leading-7 whitespace-pre-line">
                                    {section.body}
                                </p>
                            </div>
                        </section>
                    ))}
                </div>
            </main>
        </div>
    );
}
