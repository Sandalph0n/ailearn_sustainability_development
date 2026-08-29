import { RolesTable, type RoleListItem } from '@/components/admin/roles/roles-table';
import { PAGE_SIZE, pageCountOf, parseListParams } from '@/lib/admin/list-params';
import { db } from '@/lib/db';

/**
 * Bảng vai trò, dùng chung cho hai lối vào.
 *
 *     /admin/institutions/<id>/roles   lối vào chính — đã khoá theo một cơ sở
 *     /admin/roles                     nhìn xuyên mọi cơ sở
 */
export async function RolesSection({
    searchParams,
    lockedInstitutionId = null,
}: {
    searchParams: Record<string, string | string[] | undefined>;
    lockedInstitutionId?: string | null;
}) {
    const SORT_FIELDS = ['roleName', 'scopeType', 'institution', 'assignments'] as const;
    const { q, page, sort, dir, skip } = parseListParams(searchParams, SORT_FIELDS);

    const raw = Array.isArray(searchParams.institution)
        ? searchParams.institution[0]
        : searchParams.institution;
    const institutionId = lockedInstitutionId ?? (raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null);

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
        lockedInstitutionId
            ? db.institution.findMany({
                  where: { id: lockedInstitutionId },
                  select: { id: true, name: true },
              })
            : db.institution.findMany({
                  orderBy: { name: 'asc' },
                  select: { id: true, name: true },
              }),
        // Ô "Included by" chỉ chào vai trò CÙNG cơ sở. Bảng này nhỏ nên nạp hết rẻ hơn một truy
        // vấn riêng cho mỗi lần mở hộp thoại.
        db.role.findMany({
            where: lockedInstitutionId ? { institutionId: lockedInstitutionId } : {},
            orderBy: { roleName: 'asc' },
            select: { id: true, roleName: true, institutionId: true },
        }),
    ]);

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
        <RolesTable
            roles={roles}
            institutions={institutions}
            institutionId={institutionId}
            locked={lockedInstitutionId !== null}
            rolesByInstitution={rolesByInstitution}
            page={page}
            pageCount={pageCountOf(total)}
            total={total}
            sort={sort}
            dir={dir}
        />
    );
}
