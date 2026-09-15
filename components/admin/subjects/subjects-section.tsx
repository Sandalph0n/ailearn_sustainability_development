import {
    SubjectsTable,
    type SubjectCapabilities,
    type SubjectInstitutionOption,
    type SubjectListItem,
} from '@/components/admin/subjects/subjects-table';
import {
    PAGE_SIZE,
    pageCountOf,
    parseListParams,
    parseOptionalUuid,
} from '@/lib/admin/list-params';
import { db } from '@/lib/db';
import { catalogInfoFor } from '@/lib/institution-adapters';

/**
 * Bảng môn học dùng chung cho các lối vào quản trị hệ thống và quản trị theo institution.
 *
 * ─── Vì sao tách ra khỏi trang ──────────────────────────────────────────────
 *
 *     /admin/institutions/<id>/subjects   lối vào chính — đã khoá theo một cơ sở
 *     /admin/subjects                     nhìn toàn hệ thống, chọn cơ sở bằng bộ lọc
 *     /navigation/institution/subjects    thao tác theo permission của active role
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
    endpoint,
    contextQuery,
    capabilities,
}: {
    searchParams: Record<string, string | string[] | undefined>;
    lockedInstitutionId?: string | null;
    endpoint?: string;
    contextQuery?: string;
    capabilities?: SubjectCapabilities;
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

    const canView = capabilities?.view ?? true;
    const [rows, total, institutions] = await Promise.all([
        canView
            ? db.subject.findMany({
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
              })
            : Promise.resolve([]),
        canView ? db.subject.count({ where }) : Promise.resolve(0),
        // Trang con không cần danh sách để lọc, nhưng biểu mẫu vẫn cần một mục cho ô chọn.
        // `website` là thứ quyết định cơ sở có danh mục công khai để tra cứu hay không.
        lockedInstitutionId
            ? db.institution.findMany({
                  where: { id: lockedInstitutionId },
                  select: { id: true, name: true, website: true },
              })
            : db.institution.findMany({
                  orderBy: { name: 'asc' },
                  select: { id: true, name: true, website: true },
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

    const institutionOptions: SubjectInstitutionOption[] = institutions.map((institution) => ({
        id: institution.id,
        name: institution.name,
        catalog: catalogInfoFor(institution),
    }));

    return (
        <SubjectsTable
            subjects={subjects}
            institutions={institutionOptions}
            institutionId={institutionId}
            locked={lockedInstitutionId !== null}
            page={page}
            pageCount={pageCountOf(total)}
            total={total}
            sort={sort}
            dir={dir}
            endpoint={endpoint}
            contextQuery={contextQuery}
            capabilities={capabilities}
        />
    );
}
