import {
    RolesTable,
    type RoleInheritanceOption,
    type RoleListItem,
} from '@/components/admin/roles/roles-table';
import {
    PAGE_SIZE,
    pageCountOf,
    parseListParams,
    parseOptionalUuid,
} from '@/lib/admin/list-params';
import { effectivePermissionIdsByRole } from '@/lib/admin/role-inheritance';
import { db } from '@/lib/db';
import type { CrudCapabilities } from '@/lib/admin/resource-capabilities';

/**
 * Bảng vai trò, dùng chung cho hai lối vào.
 *
 *     /admin/institutions/<id>/roles   lối vào chính — đã khoá theo một cơ sở
 *     /admin/roles                     nhìn xuyên mọi cơ sở
 */
export async function RolesSection({
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
    capabilities?: CrudCapabilities;
}) {
    const SORT_FIELDS = ['roleName', 'roleCode', 'scopeType', 'institution'] as const;
    const { q, page, sort, dir, skip } = parseListParams(searchParams, SORT_FIELDS);

    const institutionId =
        lockedInstitutionId ?? parseOptionalUuid(searchParams.institution);

    const where = {
        ...(institutionId ? { institutionId } : {}),
        ...(q
            ? {
                  OR: [
                      { roleName: { contains: q, mode: 'insensitive' as const } },
                      { roleCode: { contains: q, mode: 'insensitive' as const } },
                  ],
              }
            : {}),
    };

    const orderBy =
        sort === 'scopeType'
            ? { scopeType: dir }
            : sort === 'roleCode'
              ? { roleCode: dir }
            : sort === 'institution'
              ? { institution: { name: dir } }
              : { roleName: dir };

    const [rows, total, institutions, allRoles, permissions] = await Promise.all([
        db.role.findMany({
            where,
            orderBy: [orderBy, { id: 'asc' }],
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                roleCode: true,
                roleName: true,
                scopeType: true,
                requestMode: true,
                autoGrantEmailRegex: true,
                requestVisibilityRules: {
                    select: { requiredRole: { select: { id: true, roleName: true } } },
                },
                includedRoles: {
                    select: { includedRole: { select: { id: true, roleName: true } } },
                },
                permissions: {
                    where: { revokedAt: null },
                    select: {
                        permission: { select: { id: true, permission: true, description: true } },
                    },
                },
                institution: { select: { id: true, name: true } },
                _count: {
                    select: {
                        roleAssignments: { where: { roleRevokedAt: null } },
                        roleRequests: { where: { status: 'PENDING' } },
                    },
                },
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
        // vấn riêng cho mỗi lần mở editor.
        db.role.findMany({
            where: lockedInstitutionId ? { institutionId: lockedInstitutionId } : {},
            orderBy: { roleName: 'asc' },
            select: {
                id: true,
                roleCode: true,
                roleName: true,
                scopeType: true,
                institutionId: true,
                includedRoles: { select: { includedRoleId: true } },
                permissions: {
                    where: { revokedAt: null },
                    select: { permissionId: true },
                },
            },
        }),
        db.permission.findMany({
            orderBy: { permission: 'asc' },
            select: { id: true, permission: true, description: true },
        }),
    ]);

    const inheritedPermissions = effectivePermissionIdsByRole(
        allRoles.map((role) => ({
            id: role.id,
            includedRoleIds: role.includedRoles.map((edge) => edge.includedRoleId),
            directPermissionIds: role.permissions.map((edge) => edge.permissionId),
        })),
    );

    const rolesByInstitution: Record<string, RoleInheritanceOption[]> = {};
    for (const role of allRoles) {
        (rolesByInstitution[role.institutionId] ??= []).push({
            id: role.id,
            roleCode: role.roleCode,
            roleName: role.roleName,
            scopeType: role.scopeType,
            effectivePermissionIds: inheritedPermissions.get(role.id) ?? [],
        });
    }

    const roles: RoleListItem[] = rows.map((row) => ({
        id: row.id,
        roleCode: row.roleCode,
        roleName: row.roleName,
        scopeType: row.scopeType,
        requestMode: row.requestMode,
        autoGrantEmailRegex: row.autoGrantEmailRegex,
        prerequisiteRoles: row.requestVisibilityRules.map((rule) => rule.requiredRole),
        includedRoles: row.includedRoles.map((edge) => edge.includedRole),
        permissions: row.permissions.map((edge) => edge.permission),
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
            permissions={permissions}
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
