import { SubjectsTable, type SubjectListItem } from '@/components/admin/subjects/subjects-table';
import { PAGE_SIZE, pageCountOf, parseListParams } from '@/lib/admin/list-params';
import { db } from '@/lib/db';

/**
 * Danh sách môn học của mọi cơ sở, lọc được theo một cơ sở.
 *
 * ─── Vì sao MỘT trang kèm bộ lọc, không phải mỗi trường một trang ───────────
 *
 * `Subject` thuộc về một cơ sở, nên cách hiển nhiên là đặt nó dưới
 * `/admin/institutions/<id>/subjects`. Nhưng làm vậy với cả Subject, Term, Role, Offering,
 * People và Requests là sáu bộ CRUD gần như giống hệt nhau, và người quản trị toàn hệ thống mất
 * khả năng nhìn tất cả cùng lúc.
 *
 * Một trang kèm `?institution=<id>` làm được cả hai việc. Trang chi tiết cơ sở chỉ việc trỏ tới
 * đường dẫn đã lọc sẵn.
 */
export const dynamic = 'force-dynamic';

const SORT_FIELDS = ['subjectCode', 'subjectName', 'institution', 'offerings'] as const;

export default async function AdminSubjectsPage({ searchParams }: PageProps<'/admin/subjects'>) {
    const resolved = await searchParams;
    const { q, page, sort, dir, skip } = parseListParams(resolved, SORT_FIELDS);

    // Bộ lọc cơ sở đứng ngoài `parseListParams` vì nó không có mặt ở mọi bảng.
    const rawInstitution = Array.isArray(resolved.institution)
        ? resolved.institution[0]
        : resolved.institution;
    const institutionId =
        rawInstitution && /^[0-9a-f-]{36}$/i.test(rawInstitution) ? rawInstitution : null;

    const where = {
        ...(institutionId ? { institutionId } : {}),
        ...(q
            ? {
                  OR: [
                      { subjectCode: { contains: q, mode: 'insensitive' as const } },
                      { subjectName: { contains: q, mode: 'insensitive' as const } },
                  ],
              }
            : {}),
    };

    const orderBy =
        sort === 'subjectName'
            ? { subjectName: dir }
            : sort === 'institution'
              ? { institution: { name: dir } }
              : sort === 'offerings'
                ? { offerings: { _count: dir } }
                : { subjectCode: dir };

    const [rows, total, institutions] = await Promise.all([
        db.subject.findMany({
            where,
            orderBy,
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                subjectCode: true,
                subjectName: true,
                subjectDescription: true,
                institution: { select: { id: true, name: true } },
                _count: { select: { offerings: true } },
            },
        }),
        db.subject.count({ where }),
        // Danh sách cho bộ lọc và cho ô chọn trong biểu mẫu.
        db.institution.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);

    const subjects: SubjectListItem[] = rows.map((row) => ({
        id: row.id,
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        subjectDescription: row.subjectDescription,
        institution: row.institution,
        counts: { offerings: row._count.offerings },
    }));

    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">Subjects</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    The units each institution teaches. A subject runs in a term as an offering,
                    and assessments hang off that.
                </p>
            </section>

            <SubjectsTable
                subjects={subjects}
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
