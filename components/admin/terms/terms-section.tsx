import { TermsTable, type TermListItem } from '@/components/admin/terms/terms-table';
import {
    PAGE_SIZE,
    pageCountOf,
    parseListParams,
    parseOptionalUuid,
} from '@/lib/admin/list-params';
import { db } from '@/lib/db';
import type { CrudCapabilities } from '@/lib/admin/resource-capabilities';

/** Ngày hiển thị gọn. Định dạng ở SERVER để hai bên không lệch múi giờ. */
const DATE = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Bảng kỳ học, dùng chung cho hai lối vào.
 *
 *     /admin/institutions/<id>/terms   lối vào chính — đã khoá theo một cơ sở
 *     /admin/terms                     nhìn xuyên mọi cơ sở
 */
export async function TermsSection({
    searchParams,
    lockedInstitutionId = null,
    endpoint,
    detailBasePath,
    contextQuery,
    capabilities,
}: {
    searchParams: Record<string, string | string[] | undefined>;
    lockedInstitutionId?: string | null;
    endpoint?: string;
    detailBasePath?: string;
    contextQuery?: string;
    capabilities?: CrudCapabilities;
}) {
    const SORT_FIELDS = ['year', 'institution', 'periods', 'offerings'] as const;
    const { q, page, sort, dir, skip } = parseListParams(searchParams, SORT_FIELDS);

    const institutionId =
        lockedInstitutionId ?? parseOptionalUuid(searchParams.institution);

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
            // Sắp xếp phụ theo `session` để hai kỳ cùng năm luôn ra cùng thứ tự.
            orderBy: [orderBy, { session: 'asc' }, { id: 'asc' }],
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                year: true,
                session: true,
                institution: { select: { id: true, name: true } },
                _count: { select: { periods: true, offerings: true } },
                periods: { select: { startAt: true, endAt: true } },
            },
        }),
        db.studyTerm.count({ where }),
        lockedInstitutionId
            ? db.institution.findMany({
                  where: { id: lockedInstitutionId },
                  select: { id: true, name: true },
              })
            : db.institution.findMany({
                  orderBy: { name: 'asc' },
                  select: { id: true, name: true },
              }),
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
        <TermsTable
            terms={terms}
            institutions={institutions}
            institutionId={institutionId}
            locked={lockedInstitutionId !== null}
            page={page}
            pageCount={pageCountOf(total)}
            total={total}
            sort={sort}
            dir={dir}
            endpoint={endpoint}
            detailBasePath={detailBasePath}
            contextQuery={contextQuery}
            capabilities={capabilities}
        />
    );
}
