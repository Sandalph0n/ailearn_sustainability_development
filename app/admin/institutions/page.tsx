import {
    InstitutionsTable,
    type InstitutionListItem,
} from '@/components/admin/institutions/institutions-table';
import { PAGE_SIZE, pageCountOf, parseListParams } from '@/lib/admin/list-params';
import { db } from '@/lib/db';

/**
 * Danh sách cơ sở giáo dục.
 *
 * ─── Lọc, sắp xếp và phân trang đều do SERVER làm ────────────────────────────
 *
 * Tham số nằm trên URL (`?q=…&page=2&sort=name&dir=desc`), trang này đọc rồi dịch thẳng thành
 * `where` / `orderBy` / `take` / `skip`. Trình duyệt chỉ nhận đúng một trang dữ liệu.
 *
 * Lý do chính không phải hiệu năng mà là: URL trở thành trạng thái. Kết quả tìm kiếm chia sẻ
 * được, đánh dấu được, F5 không mất, nút Back quay lại đúng bộ lọc trước. Xem `lib/admin/list-params.ts`.
 *
 * ─── Vì sao đọc database thẳng ở đây, không qua API ─────────────────────────
 *
 * Đây là Server Component — nó đã chạy trên server rồi. Gọi `fetch('/api/...')` từ đây là bắt
 * server tự gửi một request HTTP tới chính nó.
 *
 * Ghi dữ liệu thì ngược lại, vẫn đi qua `/api/admin/institutions` — nó phát ra từ trình duyệt.
 */
export const dynamic = 'force-dynamic';

/**
 * Các cột được phép sắp xếp. Phần tử đầu là mặc định.
 *
 * Danh sách này là DUY NHẤT nguồn cho phép — `sort` đến từ query string nên người dùng gõ được
 * bất cứ gì, và giá trị đó đi thẳng vào `orderBy` của Prisma.
 */
const SORT_FIELDS = ['name', 'subjects', 'terms'] as const;

export default async function AdminInstitutionsPage({
    searchParams,
}: PageProps<'/admin/institutions'>) {
    const { q, page, sort, dir, skip } = parseListParams(await searchParams, SORT_FIELDS);

    // `mode: 'insensitive'` để "macquarie" tìm ra "Macquarie University".
    const where = q ? { name: { contains: q, mode: 'insensitive' as const } } : {};

    // Sắp xếp theo số lượng phải dùng `_count`, không phải tên cột.
    const orderBy =
        sort === 'name'
            ? { name: dir }
            : sort === 'subjects'
              ? { subjects: { _count: dir } }
              : { studyTerms: { _count: dir } };

    // Một trang dữ liệu và tổng số dòng, chạy song song — hai truy vấn độc lập.
    const [rows, total] = await Promise.all([
        db.institution.findMany({
            where,
            orderBy: [orderBy, { id: 'asc' }],
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                name: true,
                website: true,
                // Đếm ngay trong một truy vấn thay vì gọi `count()` cho từng cơ sở — cách kia là
                // N+1: mười cơ sở thành ba mươi lượt hỏi database.
                _count: {
                    select: { subjects: true, studyTerms: true, roles: true, roleRequests: true },
                },
            },
        }),
        db.institution.count({ where }),
    ]);

    const institutions: InstitutionListItem[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        website: row.website,
        counts: {
            subjects: row._count.subjects,
            terms: row._count.studyTerms,
            roles: row._count.roles,
            requests: row._count.roleRequests,
        },
    }));

    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">Institutions</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    Schools and universities using the platform. Every subject, term and role
                    belongs to one of these.
                </p>
            </section>

            <InstitutionsTable
                institutions={institutions}
                page={page}
                pageCount={pageCountOf(total)}
                total={total}
                sort={sort}
                dir={dir}
                query={q}
            />
        </div>
    );
}
