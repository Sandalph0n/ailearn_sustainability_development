import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    BookOpen01Icon,
    Calendar03Icon,
    CheckListIcon,
    LinkSquare02Icon,
    Shield01Icon,
    UserMultipleIcon,
    UserSharingIcon,
} from '@hugeicons/core-free-icons';

import { InstitutionFormDialog } from '@/components/admin/institutions/institution-form-dialog';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { db } from '@/lib/db';

/**
 * Trang cài đặt của MỘT cơ sở giáo dục.
 *
 * ─── Trang này đang là khung rỗng ────────────────────────────────────────────
 *
 * Các mục bên dưới liệt kê những gì một trường cần cấu hình, kèm số lượng thật đọc từ database.
 * Chưa mục nào có trang con — bấm vào chưa đi đâu cả. Dựng khung trước để nhìn thấy toàn cảnh
 * rồi mới quyết làm mục nào trước.
 *
 * ─── Vì sao mọi thứ ở đây thuộc về MỘT trường ────────────────────────────────
 *
 * `Subject`, `StudyTerm`, `Role`, `RoleRequest` đều mang `institutionId` và đều `onDelete:
 * Cascade`. Nghĩa là chúng không tồn tại độc lập — hai trường có thể cùng có môn tên "COMP3000"
 * mà là hai môn khác nhau, cùng có vai trò tên "Tutor" mà là hai vai trò khác nhau.
 *
 * Nên nơi đúng để cấu hình chúng là ở đây, trong phạm vi một trường, chứ không phải một danh
 * sách phẳng toàn hệ thống.
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
        },
        {
            key: 'terms',
            icon: Calendar03Icon,
            title: 'Study terms',
            description:
                'Years and sessions, and the teaching, break and exam periods inside each.',
            count: institution._count.studyTerms,
            unit: 'term',
        },
        {
            key: 'offerings',
            icon: CheckListIcon,
            title: 'Offerings',
            description: 'Which subject runs in which term. Assessments hang off these.',
            count: offerings,
            unit: 'offering',
        },
        {
            key: 'roles',
            icon: Shield01Icon,
            title: 'Roles',
            description:
                'Role definitions, what each may do, and which roles include which others.',
            count: institution._count.roles,
            unit: 'role',
        },
        {
            key: 'people',
            icon: UserMultipleIcon,
            title: 'People',
            description: 'Who holds which role here, and in which offering.',
            count: activeAssignments,
            unit: 'active assignment',
        },
        {
            key: 'requests',
            icon: UserSharingIcon,
            title: 'Join requests',
            description: 'People asking for a role here, waiting to be approved or rejected.',
            count: pendingRequests,
            unit: 'pending request',
        },
    ];

    return (
        <div className="flex flex-col gap-8">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink render={<Link href="/admin/institutions" />}>
                            Institutions
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{institution.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <section className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="font-heading text-2xl font-medium tracking-tight">
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

            <section className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="font-heading text-lg font-medium">Setup</h2>
                    <p className="text-muted-foreground text-sm">
                        Everything below belongs to this institution alone. None of it is built
                        yet.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.map((section) => (
                        <Card key={section.key} className="opacity-70">
                            <CardHeader>
                                <div className="mb-3 flex items-start justify-between">
                                    <div className="bg-secondary text-secondary-foreground flex size-9 items-center justify-center rounded-lg">
                                        <HugeiconsIcon
                                            icon={section.icon}
                                            strokeWidth={2}
                                            className="size-4"
                                        />
                                    </div>
                                    <Badge variant="secondary">Not built yet</Badge>
                                </div>
                                <CardTitle>{section.title}</CardTitle>
                                <CardDescription>{section.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <span className="text-muted-foreground text-sm tabular-nums">
                                    {section.count} {section.unit}
                                    {section.count === 1 ? '' : 's'}
                                </span>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    );
}
