import { notFound } from 'next/navigation';

import { UsersTable, type UserListItem } from '@/components/admin/users/users-table';
import { PAGE_SIZE, pageCountOf, parseListParams } from '@/lib/admin/list-params';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';

/**
 * Danh sách tài khoản.
 *
 * ─── Chỉ ĐỌC, trừ đúng một cờ ────────────────────────────────────────────────
 *
 * Không tạo, không sửa email hay tên, không xoá. Tài khoản do chính người dùng lập qua đăng ký,
 * và mọi bài nộp trong hệ thống gắn với một `userId` — cho phép quản trị viên đổi danh tính
 * người khác là mở đường sửa lại "ai đã làm bài nào".
 *
 * Thứ duy nhất đổi được là `isSystemAdmin`, vì đó là quyền do người vận hành cấp chứ không phải
 * dữ liệu của người dùng.
 */
export const dynamic = 'force-dynamic';

const SORT_FIELDS = ['lastName', 'createdAt', 'roles', 'attempts', 'isSystemAdmin'] as const;

const DATE = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

export default async function AdminUsersPage({ searchParams }: PageProps<'/admin/users'>) {
    const { q, page, sort, dir, skip } = parseListParams(await searchParams, SORT_FIELDS);

    // Layout đã chặn người không phải quản trị viên, nên nhánh này gần như không chạy. Giữ lại
    // để TypeScript biết `session` không null, và để trang không vỡ nếu bị đặt ở chỗ khác.
    const session = await getCurrentSession();
    if (!session) notFound();

    const where = q
        ? {
              OR: [
                  { email: { contains: q, mode: 'insensitive' as const } },
                  { firstName: { contains: q, mode: 'insensitive' as const } },
                  { lastName: { contains: q, mode: 'insensitive' as const } },
              ],
          }
        : {};

    const orderBy =
        sort === 'createdAt'
            ? { createdAt: dir }
            : sort === 'roles'
              ? { roleAssignments: { _count: dir } }
              : sort === 'attempts'
                ? { attempts: { _count: dir } }
                : sort === 'isSystemAdmin'
                  ? { isSystemAdmin: dir }
                  : { lastName: dir };

    const [rows, total] = await Promise.all([
        db.user.findMany({
            where,
            orderBy,
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isSystemAdmin: true,
                createdAt: true,
                // KHÔNG chọn `passwordHash`. Nó không có việc gì ở tầng giao diện, và mỗi chỗ
                // đọc nó là thêm một chỗ có thể lỡ tay gửi ra ngoài.
                _count: { select: { roleAssignments: true, attempts: true } },
            },
        }),
        db.user.count({ where }),
    ]);

    const users: UserListItem[] = rows.map((row) => ({
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        isSystemAdmin: row.isSystemAdmin,
        joined: DATE.format(row.createdAt),
        counts: { roles: row._count.roleAssignments, attempts: row._count.attempts },
    }));

    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">Users</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    Every account on the platform. System admins reach this area; roles at an
                    institution are granted separately.
                </p>
            </section>

            <UsersTable
                users={users}
                currentUserId={session.user.id}
                page={page}
                pageCount={pageCountOf(total)}
                total={total}
                sort={sort}
                dir={dir}
            />
        </div>
    );
}
