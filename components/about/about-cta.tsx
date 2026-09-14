import Link from 'next/link';

import { Reveal } from '@/components/reveal';
import { buttonVariants } from '@/components/ui/button';

/** Lời mời cuối trang About — cùng một khối bo góc phủ gradient như ở trang giới thiệu. */
export function AboutCta() {
    return (
        <section className="pb-20 md:pb-28">
            <div className="mx-auto max-w-7xl px-5 md:px-8">
                <Reveal variant="scale">
                    <div className="border-border relative overflow-hidden rounded-3xl border px-6 py-16 text-center">
                        <div
                            aria-hidden
                            className="from-brand-teal/12 via-brand-sky/10 to-brand-violet/16 absolute inset-0 bg-linear-to-br"
                        />
                        <div className="relative">
                            <h2 className="font-heading mb-6 text-3xl font-bold tracking-tight md:text-4xl">
                                Bring your tools together. Make every step count.
                            </h2>
                            <Link
                                href="/auth"
                                className={buttonVariants({
                                    size: 'lg',
                                    className: 'shadow-primary/25 h-12 px-8 shadow-lg',
                                })}
                            >
                                Start learning
                            </Link>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
