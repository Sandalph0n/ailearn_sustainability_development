import { SubjectsTable, type SubjectListItem } from '@/components/admin/subjects/subjects-table';
import {
    PAGE_SIZE,
    pageCountOf,
    parseListParams,
    parseOptionalUuid,
} from '@/lib/admin/list-params';
import { db } from '@/lib/db';

/**
 * Bảng môn học, dùng chung cho HAI lối vào.
 *
 * ─── Vì sao tách ra khỏi trang ──────────────────────────────────────────────
 *
 *     /admin/institutions/<id>/subjects   lối vào chính — đã khoá theo một cơ sở
 *     /admin/subjects                     nhìn toàn hệ thống, chọn cơ sở bằng bộ lọc
 *
 * Hai trang, một truy vấn, một bảng. Chép đôi thì sớm muộn hai bên lệch nhau — bên này thêm cột,
 * bên kia quên.
 *
 * `lockedInstitutionId` có mặt nghĩa là đang ở trang con: cột "Institution" và bộ lọc biến mất
 * (thừa, vì mọi hàng đều cùng một cơ sở), và biểu mẫu tạo mới điền sẵn cơ sở đó.
 */
export async function SubjectsSection({
    searchParams,
    lockedInstitutionId = null,
}: {
    searchParams: Record<string, string | string[] | undefined>;
    lockedInstitutionId?: string | null;
}) {
    const SORT_FIELDS = ['subjectCode', 'subjectName', 'institution', 'offerings'] as const;
    const { q, page, sort, dir, skip } = parseListParams(searchParams, SORT_FIELDS);

    // Trang con khoá cứng theo đường dẫn; trang toàn hệ thống đọc từ `?institution=`.
    const institutionId =
        lockedInstitutionId ?? parseOptionalUuid(searchParams.institution);

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
            orderBy: [orderBy, { id: 'asc' }],
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
        // Trang con không cần danh sách để lọc, nhưng biểu mẫu vẫn cần một mục cho ô chọn.
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

    const subjects: SubjectListItem[] = rows.map((row) => ({
        id: row.id,
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        subjectDescription: row.subjectDescription,
        institution: row.institution,
        counts: { offerings: row._count.offerings },
    }));

    return (
        <SubjectsTable
            subjects={subjects}
            institutions={institutions}
            institutionId={institutionId}
            locked={lockedInstitutionId !== null}
            page={page}
            pageCount={pageCountOf(total)}
            total={total}
            sort={sort}
            dir={dir}
        />
    );
}
