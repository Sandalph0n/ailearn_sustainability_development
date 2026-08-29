import { RolesSection } from '@/components/admin/roles/roles-section';

/**
 * Roles của MỌI cơ sở.
 *
 * Lối vào chính là trang con của từng cơ sở — `/admin/institutions/<id>/roles` — vì bản ghi này
 * không tồn tại độc lập với cơ sở. Trang này phục vụ việc khác: nhìn XUYÊN mọi cơ sở.
 */
export const dynamic = 'force-dynamic';

export default async function AdminRolesPage({ searchParams }: PageProps<'/admin/roles'>) {
    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">Roles</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    Every role across all institutions. To manage one institution&rsquo;s roles, open that institution instead.
                </p>
            </section>

            <RolesSection searchParams={await searchParams} />
        </div>
    );
}
