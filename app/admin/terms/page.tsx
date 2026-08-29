import { TermsTable, type TermListItem } from '@/components/admin/terms/terms-table';
import { PAGE_SIZE, pageCountOf, parseListParams } from '@/lib/admin/list-params';
import { db } from '@/lib/db';

/**
 * Danh sách kỳ học.
 *
 * ─── Vì sao kỳ học là mắt xích dưới cùng ────────────────────────────────────
 *
 * Không có kỳ thì không tạo được `Offering`; không có Offering thì không có `Assessment`; không
 * có Assessment thì không có bài nộp nào để phát lại. Mọi thứ khác trong hệ thống treo lên đây.
 */
export const dynamic = 'force-dynamic';

const SORT_FIELDS = ['year', 'institution', 'periods', 'offerings'] as const;

/** Ngày hiển thị gọn: "18 Aug 2026". Định dạng ở SERVER để hai bên không lệch múi giờ. */
const DATE = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

export default async function AdminTermsPage({ searchParams }: PageProps<'/admin/terms'>) {
    const resolved = await searchParams;
    const { q, page, sort, dir, skip } = parseListParams(resolved, SORT_FIELDS);

    const rawInstitution = Array.isArray(resolved.institution)
        ? resolved.institution[0]
        : resolved.institution;
    const institutionId =
        rawInstitution && /^[0-9a-f-]{36}$/i.test(rawInstitution) ? rawInstitution : null;

    // Kỳ học không có trường chữ nào để tìm, nên ô tìm kiếm khớp theo NĂM. Chuỗi không phải số
    // thì không khớp gì cả, thay vì báo lỗi.
    const year = /^\d{1,4}$/.test(q) ? Number(q) : null;
    const where = {
        ...(institutionId ? { institutionId } : {}),
        ...(q ? (year === null ? { id: '00000000-0000-0000-0000-000000000000' } : { year }) : {}),
    };

    const orderBy =
        sort === 'institution'
            ? { institution: { name: dir } }
            : sort === 'periods'
              ? { periods: { _count: dir } }
              : sort === 'offerings'
                ? { offerings: { _count: dir } }
                : { year: dir };

    const [rows, total, institutions] = await Promise.all([
        db.studyTerm.findMany({
            where,
            // Sắp xếp phụ theo `session` để hai kỳ cùng năm luôn ra cùng thứ tự, không phụ thuộc
            // vào thứ tự vật lý của bảng.
            orderBy: [orderBy, { session: 'asc' }],
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                year: true,
                session: true,
                institution: { select: { id: true, name: true } },
                _count: { select: { periods: true, offerings: true } },
                // Lấy mốc đầu và mốc cuối để suy ra khoảng thời gian của cả kỳ.
                periods: { select: { startAt: true, endAt: true } },
            },
        }),
        db.studyTerm.count({ where }),
        db.institution.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);

    const terms: TermListItem[] = rows.map((row) => {
        const starts = row.periods.map((period) => period.startAt.getTime());
        const ends = row.periods.map((period) => period.endAt.getTime());

        return {
            id: row.id,
            year: row.year,
            session: row.session,
            institution: row.institution,
            counts: { periods: row._count.periods, offerings: row._count.offerings },
            span:
                starts.length > 0
                    ? `${DATE.format(new Date(Math.min(...starts)))} – ${DATE.format(new Date(Math.max(...ends)))}`
                    : null,
        };
    });

    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">Study terms</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    The years and sessions subjects run in. Teaching, break and exam periods live
                    inside a term and drive the calendar.
                </p>
            </section>

            <TermsTable
                terms={terms}
                institutions={institutions}
                institutionId={institutionId}
                page={page}
                pageCount={pageCountOf(total)}
                total={total}
                sort={sort}
                dir={dir}
            />
        </div>
    );
}
