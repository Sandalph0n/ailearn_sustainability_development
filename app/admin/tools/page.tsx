import { ToolsTable, type ToolListItem } from '@/components/admin/tools/tools-table';
import { PAGE_SIZE, pageCountOf, parseListParams } from '@/lib/admin/list-params';
import { db } from '@/lib/db';

/**
 * Danh sách công cụ.
 *
 * ─── Vì sao Tool là bảng TOÀN HỆ THỐNG ──────────────────────────────────────
 *
 * Khác `Subject` hay `Role`, `Tool` không mang `institutionId`. Một công cụ là phần mềm do nền
 * tảng cung cấp — trình soạn mã, trình vẽ sơ đồ — không phải dữ liệu học vụ của một trường. Mọi
 * cơ sở dùng chung cùng bộ công cụ.
 *
 * Chọn công cụ nào cho một bài tập thì nằm ở `AssessmentAllowTool`, tức là quyết định theo từng
 * bài, không phải theo trường.
 */
export const dynamic = 'force-dynamic';

const SORT_FIELDS = ['name', 'code', 'versions', 'assessments'] as const;

export default async function AdminToolsPage({ searchParams }: PageProps<'/admin/tools'>) {
    const { q, page, sort, dir, skip } = parseListParams(await searchParams, SORT_FIELDS);

    // Tìm theo cả tên lẫn mã: người dùng có thể nhớ cái này mà quên cái kia.
    const where = q
        ? {
              OR: [
                  { name: { contains: q, mode: 'insensitive' as const } },
                  { code: { contains: q, mode: 'insensitive' as const } },
              ],
          }
        : {};

    const orderBy =
        sort === 'name'
            ? { name: dir }
            : sort === 'code'
              ? { code: dir }
              : sort === 'versions'
                ? { versions: { _count: dir } }
                : sort === 'assessments'
                  ? { assessments: { _count: dir } }
                  : { name: dir };

    const [rows, total] = await Promise.all([
        db.tool.findMany({
            where,
            orderBy: [orderBy, { id: 'asc' }],
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                code: true,
                name: true,
                description: true,
                activeVersion: { select: { id: true, version: true } },
                _count: { select: { versions: true, assessments: true, workSessions: true } },
            },
        }),
        db.tool.count({ where }),
    ]);

    const tools: ToolListItem[] = rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        activeVersion: row.activeVersion,
        counts: {
            versions: row._count.versions,
            assessments: row._count.assessments,
            sessions: row._count.workSessions,
        },
    }));

    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">Tools</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    Independent web applications available to assessments. Uploads create immutable
                    versions so old sessions keep the code they were recorded with.
                </p>
            </section>

            <ToolsTable
                tools={tools}
                page={page}
                pageCount={pageCountOf(total)}
                total={total}
                sort={sort}
                dir={dir}
            />
        </div>
    );
}
