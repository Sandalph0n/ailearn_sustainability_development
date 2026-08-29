import { SubjectsSection } from '@/components/admin/subjects/subjects-section';

/**
 * Môn học của MỌI cơ sở.
 *
 * ─── Vì sao trang này vẫn tồn tại ───────────────────────────────────────────
 *
 * Lối vào chính là trang con của từng cơ sở — `/admin/institutions/<id>/subjects` — vì `Subject`
 * không tồn tại độc lập với cơ sở.
 *
 * Trang này phục vụ việc khác: nhìn XUYÊN mọi cơ sở. "Có bao nhiêu môn trên toàn nền tảng", "mã
 * COMP3000 xuất hiện ở những trường nào". Câu hỏi đó không trả lời được nếu chỉ có trang con.
 */
export const dynamic = 'force-dynamic';

export default async function AdminSubjectsPage({ searchParams }: PageProps<'/admin/subjects'>) {
    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">Subjects</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    Every subject across all institutions. To manage one institution&rsquo;s
                    subjects, open that institution instead.
                </p>
            </section>

            <SubjectsSection searchParams={await searchParams} />
        </div>
    );
}
