import {
    PermissionsTable,
    type PermissionListItem,
} from '@/components/admin/permissions/permissions-table';
import { PAGE_SIZE, pageCountOf, parseListParams } from '@/lib/admin/list-params';
import { db } from '@/lib/db';

/**
 * Từ vựng quyền của toàn nền tảng.
 *
 * Permission do MÃ NGUỒN định nghĩa và gieo vào database. Trang quản trị chỉ giúp người vận hành
 * xem quyền nào đang tồn tại và quyền đó đang được ghép vào bao nhiêu role; không có thao tác tạo,
 * sửa hay xoá vì một chuỗi không được mã nguồn kiểm tra sẽ không tạo ra quyền thật.
 */
export const dynamic = 'force-dynamic';

const SORT_FIELDS = ['permission', 'description'] as const;

export default async function AdminPermissionsPage({
    searchParams,
}: PageProps<'/admin/permissions'>) {
    const { q, page, sort, dir, skip } = parseListParams(await searchParams, SORT_FIELDS);

    const where = q
        ? {
              OR: [
                  { permission: { contains: q, mode: 'insensitive' as const } },
                  { description: { contains: q, mode: 'insensitive' as const } },
              ],
          }
        : {};

    const orderBy = sort === 'description' ? { description: dir } : { permission: dir };

    const [rows, total] = await Promise.all([
        db.permission.findMany({
            where,
            orderBy,
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                permission: true,
                description: true,
                // Chỉ đếm liên kết còn hiệu lực. Bản ghi đã thu hồi vẫn được giữ làm lịch sử.
                _count: { select: { roles: { where: { revokedAt: null } } } },
            },
        }),
        db.permission.count({ where }),
    ]);

    const permissions: PermissionListItem[] = rows.map((row) => ({
        id: row.id,
        permission: row.permission,
        description: row.description,
        activeRoles: row._count.roles,
    }));

    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">Permissions</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    Actions recognised by the platform and available when composing roles. This
                    vocabulary is defined in code and is read-only here.
                </p>
            </section>

            <PermissionsTable
                permissions={permissions}
                page={page}
                pageCount={pageCountOf(total)}
                total={total}
                sort={sort}
                dir={dir}
            />
        </div>
    );
}
