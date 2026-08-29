import { RolesTable, type RoleListItem } from '@/components/admin/roles/roles-table';
import { PAGE_SIZE, pageCountOf, parseListParams } from '@/lib/admin/list-params';
import { db } from '@/lib/db';

/**
 * Danh sách vai trò.
 *
 * ─── Vai trò thuộc về một CƠ SỞ, không phải toàn hệ thống ───────────────────
 *
 * Hai trường cùng có vai trò tên "Tutor" là hai vai trò khác nhau: quyền của chúng do từng
 * trường tự định, và người giữ vai trò ở trường này không có gì ở trường kia.
 *
 * Vai trò vận hành toàn hệ thống thì KHÔNG nằm ở đây — đó là cờ `User.isSystemAdmin`, xem
 * `app/admin/users`.
 */
export const dynamic = 'force-dynamic';

const SORT_FIELDS = ['roleName', 'scopeType', 'institution', 'assignments'] as const;

export default async function AdminRolesPage({ searchParams }: PageProps<'/admin/roles'>) {
    const resolved = await searchParams;
    const { q, page, sort, dir, skip } = parseListParams(resolved, SORT_FIELDS);

    const rawInstitution = Array.isArray(resolved.institution)
        ? resolved.institution[0]
        : resolved.institution;
    const institutionId =
        rawInstitution && /^[0-9a-f-]{36}$/i.test(rawInstitution) ? rawInstitution : null;

    const where = {
        ...(institutionId ? { institutionId } : {}),
        ...(q ? { roleName: { contains: q, mode: 'insensitive' as const } } : {}),
    };

    const orderBy =
        sort === 'scopeType'
            ? { scopeType: dir }
            : sort === 'institution'
              ? { institution: { name: dir } }
              : sort === 'assignments'
                ? { roleAssignments: { _count: dir } }
                : { roleName: dir };

    const [rows, total, institutions, allRoles] = await Promise.all([
        db.role.findMany({
            where,
            orderBy,
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                roleName: true,
                scopeType: true,
                emailRegex: true,
                includedBy: { select: { id: true, roleName: true } },
                institution: { select: { id: true, name: true } },
                _count: { select: { roleAssignments: true, roleRequests: true } },
            },
        }),
        db.role.count({ where }),
        db.institution.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
        // Mọi vai trò, để ô "Included by" chỉ chào những vai trò CÙNG cơ sở. Bảng này nhỏ —
        // một trường có vài vai trò — nên nạp hết rẻ hơn một truy vấn cho mỗi lần mở hộp thoại.
        db.role.findMany({
            orderBy: { roleName: 'asc' },
            select: { id: true, roleName: true, institutionId: true },
        }),
    ]);

    // Gom theo cơ sở ở server: client chỉ việc tra khoá, không phải lọc lại mảng mỗi lần render.
    const rolesByInstitution: Record<string, Array<{ id: string; roleName: string }>> = {};
    for (const role of allRoles) {
        (rolesByInstitution[role.institutionId] ??= []).push({
            id: role.id,
            roleName: role.roleName,
        });
    }

    const roles: RoleListItem[] = rows.map((row) => ({
        id: row.id,
        roleName: row.roleName,
        scopeType: row.scopeType,
        emailRegex: row.emailRegex,
        includedBy: row.includedBy,
        institution: row.institution,
        counts: { assignments: row._count.roleAssignments, requests: row._count.roleRequests },
    }));

    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">Roles</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    What someone can be at an institution. A role applies either institution-wide
                    or to a single offering, and an email rule can grant one automatically.
                </p>
            </section>

            <RolesTable
                roles={roles}
                institutions={institutions}
                institutionId={institutionId}
                rolesByInstitution={rolesByInstitution}
                page={page}
                pageCount={pageCountOf(total)}
                total={total}
                sort={sort}
                dir={dir}
            />
        </div>
    );
}
