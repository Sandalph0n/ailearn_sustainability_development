import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowRight01Icon,
    BookOpen01Icon,
    Calendar03Icon,
    CheckListIcon,
    LinkSquare02Icon,
    Shield01Icon,
    UserMultipleIcon,
    UserSharingIcon,
} from '@hugeicons/core-free-icons';

import { InstitutionFormDialog } from '@/components/admin/institutions/institution-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';

/**
 * Trang cài đặt của MỘT cơ sở giáo dục.
 *
 * ─── Đây là BẢNG MỤC LỤC, không phải nơi sửa dữ liệu ─────────────────────────
 *
 * Mỗi mục hiện số lượng thật và dẫn sang trang con tương ứng dưới `/admin/institutions/<id>/…`.
 * Cùng những mục đó cũng nằm trên dải tab ở layout; danh sách này thêm số lượng, nên nó trả lời
 * được câu "trường này đã cấu hình tới đâu" mà dải tab không trả lời được.
 *
 * Mục chưa dựng thì mang nhãn "Not built" và không bấm được — không giả vờ là liên kết.
 */
export const dynamic = 'force-dynamic';

type Section = {
    key: string;
    icon: typeof BookOpen01Icon;
    title: string;
    description: string;
    count: number;
    /** Chữ đứng cạnh con số, để "3" không mơ hồ. */
    unit: string;
    /**
     * Trang quản lý nằm dưới chính institution này. `null` là chưa dựng.
     */
    href: string | null;
};

export default async function InstitutionSettingsPage({
    params,
}: PageProps<'/admin/institutions/[id]'>) {
    const { id } = await params;

    // `id` lấy từ URL nên có thể là chuỗi bất kỳ. Cột là `uuid`, và một chuỗi sai định dạng khiến
    // Postgres ném lỗi cú pháp chứ không phải "không tìm thấy" — chặn trước để ra 404 cho đúng.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        notFound();
    }

    const institution = await db.institution.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            website: true,
            _count: { select: { subjects: true, studyTerms: true, roles: true } },
        },
    });

    if (!institution) {
        notFound();
    }

    // Ba phép đếm còn lại không nằm trong `_count` của Institution vì chúng đi qua một bảng trung
    // gian. Chạy song song — chúng độc lập, xếp tuần tự thì tổng thời gian là tổng của cả ba.
    const [offerings, activeAssignments, pendingRequests] = await Promise.all([
        db.offering.count({ where: { subject: { institutionId: id } } }),
        // `roleRevokedAt: null` = vai trò còn hiệu lực. Dòng đã thu hồi vẫn nằm trong bảng để
        // giữ lịch sử, nên đếm tất là ra một con số vô nghĩa.
        db.roleAssignment.count({ where: { role: { institutionId: id }, roleRevokedAt: null } }),
        db.roleRequest.count({ where: { institutionId: id, status: 'PENDING' } }),
    ]);

    const sections: Section[] = [
        {
            key: 'subjects',
            icon: BookOpen01Icon,
            title: 'Subjects',
            description: 'The units this institution teaches, with their codes and names.',
            count: institution._count.subjects,
            unit: 'subject',
            href: `/admin/institutions/${id}/subjects`,
        },
        {
            key: 'terms',
            icon: Calendar03Icon,
            title: 'Study terms',
            description:
                'Years and sessions, and the teaching, break and exam periods inside each.',
            count: institution._count.studyTerms,
            unit: 'term',
            href: `/admin/institutions/${id}/terms`,
        },
        {
            key: 'offerings',
            icon: CheckListIcon,
            title: 'Offerings',
            description: 'Which subject runs in which term. Assessments hang off these.',
            count: offerings,
            unit: 'offering',
            href: `/admin/institutions/${id}/offerings`,
        },
        {
            key: 'roles',
            icon: Shield01Icon,
            title: 'Roles',
            description:
                'Role definitions, what each may do, and which roles include which others.',
            count: institution._count.roles,
            unit: 'role',
            href: `/admin/institutions/${id}/roles`,
        },
        {
            key: 'people',
            icon: UserMultipleIcon,
            title: 'People',
            description: 'Who holds which role here, and in which offering.',
            count: activeAssignments,
            unit: 'active assignment',
            href: `/admin/institutions/${id}/people`,
        },
        {
            key: 'requests',
            icon: UserSharingIcon,
            title: 'Join requests',
            description: 'People asking for a role here, waiting to be approved or rejected.',
            count: pendingRequests,
            unit: 'pending request',
            href: `/admin/institutions/${id}/requests`,
        },
    ];

    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="font-heading text-xl font-semibold tracking-tight">
                        {institution.name}
                    </h1>
                    {institution.website ? (
                        <a
                            href={institution.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
                        >
                            {institution.website.replace(/^https?:\/\//, '')}
                            <HugeiconsIcon
                                icon={LinkSquare02Icon}
                                strokeWidth={2}
                                className="size-3.5"
                            />
                        </a>
                    ) : (
                        <span className="text-muted-foreground text-sm">No website set</span>
                    )}
                </div>

                <InstitutionFormDialog
                    institution={{
                        id: institution.id,
                        name: institution.name,
                        website: institution.website,
                    }}
                    trigger={<Button variant="outline">Edit details</Button>}
                />
            </section>

            <section className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="font-heading text-base font-semibold">Setup</h2>
                    <p className="text-muted-foreground text-sm">
                        Everything below belongs to this institution alone.
                    </p>
                </div>

                {/*
                    Danh sách dày, cùng ngôn ngữ với trang tổng quan quản trị. Sáu thẻ có biểu
                    tượng và câu mô tả là khuôn của trang tiếp thị; ở đây người đọc cần liếc một
                    lượt xem trường này đã cấu hình tới đâu.
                */}
                <div className="divide-border bg-card divide-y overflow-hidden rounded-lg border">
                    {sections.map((section) => {
                        const body = (
                            <>
                                <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                                    <HugeiconsIcon
                                        icon={section.icon}
                                        strokeWidth={2}
                                        className="size-4"
                                    />
                                </div>

                                {/* `min-w-0` để mô tả dài bị cắt chứ không đẩy vỡ hàng. */}
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">{section.title}</p>
                                    <p className="text-muted-foreground truncate text-sm">
                                        {section.description}
                                    </p>
                                </div>

                                <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                                    {section.count} {section.unit}
                                    {section.count === 1 ? '' : 's'}
                                </span>

                                {section.href ? (
                                    <HugeiconsIcon
                                        icon={ArrowRight01Icon}
                                        strokeWidth={2}
                                        className="text-muted-foreground size-4 shrink-0"
                                    />
                                ) : (
                                    <Badge variant="secondary" className="shrink-0">
                                        Not built
                                    </Badge>
                                )}
                            </>
                        );

                        // Mục đã có trang thì cả hàng là liên kết; chưa có thì là một hàng
                        // trơ, không giả vờ bấm được.
                        return section.href ? (
                            <Link
                                key={section.key}
                                href={section.href}
                                className="hover:bg-muted/50 flex items-center gap-4 px-4 py-3.5 transition-colors"
                            >
                                {body}
                            </Link>
                        ) : (
                            <div key={section.key} className="flex items-center gap-4 px-4 py-3.5">
                                {body}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
