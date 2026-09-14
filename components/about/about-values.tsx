import { ChartUpIcon, UserGroupIcon, ViewIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Reveal } from '@/components/reveal';

/**
 * Ba giá trị dẫn đường.
 *
 * Biểu tượng lấy từ hugeicons chứ không phải lucide như bản base44 — dự án đã chốt bộ này trong
 * `components.json`. Ba cái tương ứng: `Eye` → `ViewIcon`, `TrendingUp` → `ChartUpIcon`,
 * `Users` → `UserGroupIcon`.
 */
const VALUES = [
    {
        icon: ViewIcon,
        title: 'Transparency',
        text: 'Learning should show the decisions, effort and growth behind the final result.',
    },
    {
        icon: ChartUpIcon,
        title: 'Flexibility',
        text: 'Students can choose and combine the tools that best support each subject and task.',
    },
    {
        icon: UserGroupIcon,
        title: 'Fairness',
        text: 'Educators deserve richer evidence to recognise different ways of learning.',
    },
] as const;

export function AboutValues() {
    return (
        <section className="bg-secondary/40 py-20 md:py-28">
            <div className="mx-auto max-w-275 px-5 md:px-8">
                <Reveal variant="blur">
                    <div className="mb-12 text-center">
                        <p className="text-brand-teal mb-3 text-3xl font-semibold">Our Values</p>
                        <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
                            What Guides the Way we build
                        </h2>
                    </div>
                </Reveal>

                <div className="grid gap-6 md:grid-cols-3">
                    {VALUES.map((value, index) => (
                        <Reveal
                            key={value.title}
                            variant="up"
                            delay={index * 0.1}
                            className="h-full"
                        >
                            <article className="border-border bg-card h-full rounded-2xl border p-7">
                                <div className="bg-brand-teal/12 mb-5 flex size-11 items-center justify-center rounded-xl">
                                    <HugeiconsIcon
                                        icon={value.icon}
                                        strokeWidth={2}
                                        className="text-brand-teal size-5"
                                    />
                                </div>
                                <h3 className="font-heading mb-3 text-xl font-semibold">
                                    {value.title}
                                </h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    {value.text}
                                </p>
                            </article>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
