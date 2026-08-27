import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    BookOpen01Icon,
    TaskDone01Icon,
    Calendar03Icon,
    ArrowRight01Icon,
} from '@hugeicons/core-free-icons';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

/**
 * Các lối vào chính. Để thành dữ liệu để phần hiển thị chỉ việc lặp qua — thêm một mục là thêm
 * một dòng.
 */
const SECTIONS = [
    {
        href: '/navigation/subjects',
        icon: BookOpen01Icon,
        title: 'Subjects',
        description: 'The subjects you are enrolled in this term.',
    },
    {
        href: '/navigation/assessments',
        icon: TaskDone01Icon,
        title: 'Assessments',
        description: 'In progress, coming due, and already submitted.',
    },
    {
        href: '/navigation/calendar',
        icon: Calendar03Icon,
        title: 'Calendar',
        description: 'Due dates, class schedules, and anything you add.',
    },
] as const;

export default function HomePage() {
    return (
        <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-2">
                <h1 className="font-heading text-2xl font-medium tracking-tight">AI-Learn</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    A learning platform whose tools record how the work happened. Every action is
                    kept in order, so the whole session can be replayed later.
                </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {SECTIONS.map((section) => (
                    <Card key={section.href}>
                        <CardHeader>
                            <div className="bg-secondary text-secondary-foreground mb-3 flex size-9 items-center justify-center rounded-lg">
                                <HugeiconsIcon
                                    icon={section.icon}
                                    strokeWidth={2}
                                    className="size-4"
                                />
                            </div>
                            <CardTitle>{section.title}</CardTitle>
                            <CardDescription>{section.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link
                                href={section.href}
                                className={buttonVariants({
                                    variant: 'ghost',
                                    size: 'sm',
                                    className: '-ml-2',
                                })}
                            >
                                Open
                                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </section>
        </div>
    );
}
