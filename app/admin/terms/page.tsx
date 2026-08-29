import { TermsSection } from '@/components/admin/terms/terms-section';

/**
 * Study terms của MỌI cơ sở.
 *
 * Lối vào chính là trang con của từng cơ sở — `/admin/institutions/<id>/terms` — vì bản ghi này
 * không tồn tại độc lập với cơ sở. Trang này phục vụ việc khác: nhìn XUYÊN mọi cơ sở.
 */
export const dynamic = 'force-dynamic';

export default async function AdminTermsPage({ searchParams }: PageProps<'/admin/terms'>) {
    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">Study terms</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    Every term across all institutions. To manage one institution&rsquo;s terms, open that institution instead.
                </p>
            </section>

            <TermsSection searchParams={await searchParams} />
        </div>
    );
}
