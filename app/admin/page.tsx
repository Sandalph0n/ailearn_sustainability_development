import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    UniversityIcon,
    BookOpen01Icon,
    Calendar03Icon,
    UserMultipleIcon,
    Shield01Icon,
    ToolboxIcon,
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
import { db } from '@/lib/db';

/**
 * Các lối vào của khu quản trị. Cùng dạng dữ liệu với trang chủ điều hướng — thêm một mục là
 * thêm một dòng.
 *
 * `count` là hàm đếm chạy ở server, để mỗi thẻ hiện được số lượng thật thay vì một con số cứng.
 */
const SECTIONS = [
    {
        href: '/admin/institutions',
        icon: UniversityIcon,
        title: 'Institutions',
        description: 'Schools and universities using the platform.',
        count: () => db.institution.count(),
    },
    {
        href: '/admin/subjects',
        icon: BookOpen01Icon,
        title: 'Subjects',
        description: 'Units offered, and which term they run in.',
        count: () => db.subject.count(),
    },
    {
        href: '/admin/terms',
        icon: Calendar03Icon,
        title: 'Terms',
        description: 'Study periods and their teaching weeks.',
        count: () => db.studyTerm.count(),
    },
    {
        href: '/admin/tools',
        icon: ToolboxIcon,
        title: 'Tools',
        description: 'Tools an assessment can hand to students.',
        count: () => db.tool.count(),
    },
    {
        href: '/admin/users',
        icon: UserMultipleIcon,
        title: 'Users',
        description: 'Accounts, and what they can reach.',
        count: () => db.user.count(),
    },
    {
        href: '/admin/roles',
        icon: Shield01Icon,
        title: 'Roles',
        description: 'Role definitions and the permissions behind them.',
        count: () => db.role.count(),
    },
] as const;

export default async function AdminOverviewPage() {
    // Chạy song song: sáu phép đếm độc lập, xếp tuần tự thì tổng thời gian là tổng của cả sáu.
    const counts = await Promise.all(SECTIONS.map((section) => section.count()));

    return (
        <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-2">
                <h1 className="font-heading text-2xl font-medium tracking-tight">Administration</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    Platform-wide settings. Changes here affect every institution, so they are kept
                    apart from the rest of the app.
                </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {SECTIONS.map((section, index) => (
                    <Card key={section.href}>
                        <CardHeader>
                            <div className="mb-3 flex items-start justify-between">
                                <div className="bg-secondary text-secondary-foreground flex size-9 items-center justify-center rounded-lg">
                                    <HugeiconsIcon
                                        icon={section.icon}
                                        strokeWidth={2}
                                        className="size-4"
                                    />
                                </div>
                                <span className="text-muted-foreground font-mono text-sm tabular-nums">
                                    {counts[index]}
                                </span>
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
                                Manage
                                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </section>
        </div>
    );
}
