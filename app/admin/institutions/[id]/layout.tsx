import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InstitutionTabs } from '@/components/admin/institutions/institution-tabs';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { db } from '@/lib/db';

/**
 * Khung chung cho MỘT cơ sở giáo dục.
 *
 * ─── Vì sao mỗi mục là trang con, không phải bộ lọc trên trang toàn hệ thống ─
 *
 * `Subject`, `StudyTerm`, `Role` đều mang `institutionId` và `onDelete: Cascade` — chúng không
 * tồn tại độc lập với cơ sở. Đường dẫn nên nói đúng điều đó: `/admin/institutions/<id>/subjects`
 * đọc ra ngay "môn của trường này", còn `?institution=<id>` chỉ là một bộ lọc có thể gỡ bỏ.
 *
 * Kéo theo: chia sẻ đường dẫn thì người nhận vào đúng phạm vi, và breadcrumb có chỗ bám.
 *
 * Trang toàn hệ thống (`/admin/subjects`) vẫn còn, dành cho việc nhìn xuyên mọi cơ sở.
 *
 * ─── Vì sao khung nằm ở layout ──────────────────────────────────────────────
 *
 * Tên trường, breadcrumb và dải tab phải giống nhau ở mọi trang con. Đặt ở layout thì chuyển tab
 * không dựng lại phần đầu, và thêm một tab mới là thêm một dòng dữ liệu.
 */
export default async function InstitutionLayout({
    children,
    params,
}: LayoutProps<'/admin/institutions/[id]'>) {
    const { id } = await params;

    // `id` từ URL có thể là chuỗi bất kỳ. Cột là `uuid`, và chuỗi sai định dạng khiến Postgres
    // ném lỗi cú pháp chứ không phải "không tìm thấy" — chặn trước để ra 404 cho đúng.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        notFound();
    }

    const institution = await db.institution.findUnique({
        where: { id },
        select: { id: true, name: true },
    });

    if (!institution) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-5 pt-1">
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

            <h1 className="font-heading text-xl font-semibold tracking-tight">
                {institution.name}
            </h1>

            <InstitutionTabs institutionId={id} />

            {children}
        </div>
    );
}
