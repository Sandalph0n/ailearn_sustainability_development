import Link from 'next/link';

import { Reveal } from '@/components/reveal';
import { buttonVariants } from '@/components/ui/button';

/**
 * Câu mở đầu của About.
 *
 * Bản base44 có một `<Reveal variant="blur">` rỗng ngay trên tiêu đề — tàn dư của một dòng nhãn
 * đã bị xoá. Bỏ luôn, vì nó không dựng ra gì mà vẫn tốn một IntersectionObserver.
 */
export function AboutHero() {
    return (
        <section className="border-border/60 relative flex min-h-130 items-center overflow-hidden border-b">
            <div
                aria-hidden
                className="bg-brand-teal pointer-events-none absolute -top-40 left-1/4 size-115 rounded-full opacity-20 blur-3xl"
            />
            <div
                aria-hidden
                className="bg-brand-violet pointer-events-none absolute right-1/4 -bottom-48 size-115 rounded-full opacity-20 blur-3xl"
            />

            <div className="relative mx-auto max-w-225 px-5 py-24 text-center md:px-8">
                <Reveal variant="up" delay={0.1}>
                    <h1 className="font-heading mb-6 text-4xl leading-tight font-bold tracking-tight md:text-[55px]">
                        Turning Every Learning Journey into Meaningful Progress.
                    </h1>
                </Reveal>

                <Reveal variant="up" delay={0.2}>
                    <p className="text-muted-foreground mx-auto mb-8 max-w-[75ch] text-lg leading-relaxed md:text-xl">
                        We help students make their thinking visible, build with the tools that fit
                        each subject, and give educators a clearer, fairer view of how learning
                        happens.
                    </p>
                </Reveal>

                <Reveal variant="up" delay={0.3}>
                    <Link
                        href="/auth"
                        className={buttonVariants({ size: 'lg', className: 'h-12 px-8' })}
                    >
                        Join our mission
                    </Link>
                </Reveal>
            </div>
        </section>
    );
}
