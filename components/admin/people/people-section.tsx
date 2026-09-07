import { PeopleTable, type PersonListItem } from '@/components/admin/people/people-table';
import {
    PAGE_SIZE,
    pageCountOf,
    parseListParams,
    parseOptionalUuid,
} from '@/lib/admin/list-params';
import { CHIEF_MANAGEMENT_ROLE_CODE } from '@/lib/auth/delegation-policy';
import { db } from '@/lib/db';

const STATUS_VALUES = ['active', 'revoked', 'all'] as const;

export async function PeopleSection({
    institutionId,
    searchParams,
    endpoint,
    contextQuery,
    canManage,
    roleCapabilities,
    scopeCapabilities,
    roleFilterParam = 'role',
    allowedOfferingIds,
    allowProtectedRoles = true,
}: {
    institutionId: string;
    searchParams: Record<string, string | string[] | undefined>;
    endpoint?: string;
    contextQuery?: string;
    canManage?: boolean;
    roleCapabilities?: { create: boolean; revoke: boolean };
    scopeCapabilities?: { view: boolean; create: boolean; revoke: boolean };
    roleFilterParam?: string;
    /** Null/undefined means the whole institution; an array is the caller's exact offering scope. */
    allowedOfferingIds?: readonly string[] | null;
    /** Chief Management is only grantable by another active Chief. */
    allowProtectedRoles?: boolean;
}) {
    const SORT_FIELDS = ['user'] as const;
    const { q, page, sort, dir, skip } = parseListParams(searchParams, SORT_FIELDS);
    const roleId = parseOptionalUuid(searchParams[roleFilterParam]);
    const offeringId = parseOptionalUuid(searchParams.offering);
    const rawStatus = Array.isArray(searchParams.status)
        ? searchParams.status[0]
        : searchParams.status;
    const status = STATUS_VALUES.includes(rawStatus as (typeof STATUS_VALUES)[number])
        ? (rawStatus as (typeof STATUS_VALUES)[number])
        : 'active';

    // A filter decides which people appear. Opening a person still shows every assignment the
    // acting user is allowed to inspect under the selected status.
    const visibleAssignmentWhere = {
        role: { institutionId },
        ...(allowedOfferingIds
            ? {
                  scopeAssignments: {
                      some: {
                          offeringId: { in: [...allowedOfferingIds] },
                          revokedAt: null,
                      },
                  },
              }
            : {}),
        ...(status === 'active'
            ? { roleRevokedAt: null }
            : status === 'revoked'
              ? { roleRevokedAt: { not: null } }
              : {}),
    };
    const matchingAssignmentWhere = {
        ...visibleAssignmentWhere,
        ...(roleId ? { roleId } : {}),
        ...(offeringId
            ? { scopeAssignments: { some: { offeringId, revokedAt: null } } }
            : {}),
        ...(q
            ? {
                  OR: [
                      { user: { email: { contains: q, mode: 'insensitive' as const } } },
                      { user: { firstName: { contains: q, mode: 'insensitive' as const } } },
                      { user: { lastName: { contains: q, mode: 'insensitive' as const } } },
                      { role: { roleName: { contains: q, mode: 'insensitive' as const } } },
                  ],
              }
            : {}),
    };
    const personWhere = { roleAssignments: { some: matchingAssignmentWhere } };

    const [rows, total, users, roles, offerings] = await Promise.all([
        db.user.findMany({
            where: personWhere,
            orderBy: [{ lastName: dir }, { firstName: dir }, { id: 'asc' }],
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                roleAssignments: {
                    where: visibleAssignmentWhere,
                    orderBy: [{ role: { roleName: 'asc' } }, { roleGrantedAt: 'desc' }],
                    select: {
                        id: true,
                        roleGrantedAt: true,
                        roleRevokedAt: true,
                        role: {
                            select: {
                                id: true,
                                roleCode: true,
                                roleName: true,
                                scopeType: true,
                            },
                        },
                        scopeAssignments: {
                            where: {
                                revokedAt: null,
                                ...(allowedOfferingIds
                                    ? { offeringId: { in: [...allowedOfferingIds] } }
                                    : {}),
                            },
                            select: {
                                id: true,
                                source: true,
                                assignedDirectlyBy: {
                                    select: { firstName: true, lastName: true },
                                },
                                offering: {
                                    select: {
                                        id: true,
                                        subject: {
                                            select: { subjectCode: true, subjectName: true },
                                        },
                                        term: { select: { year: true, session: true } },
                                    },
                                },
                            },
                        },
                        fromRequest: { select: { id: true } },
                    },
                },
            },
        }),
        db.user.count({ where: personWhere }),
        db.user.findMany({
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
            select: { id: true, firstName: true, lastName: true, email: true },
        }),
        db.role.findMany({
            where: {
                institutionId,
                ...(!allowProtectedRoles
                    ? { roleCode: { not: CHIEF_MANAGEMENT_ROLE_CODE } }
                    : {}),
            },
            orderBy: [{ roleName: 'asc' }, { id: 'asc' }],
            select: { id: true, roleName: true, scopeType: true },
        }),
        db.offering.findMany({
            where: {
                subject: { institutionId },
                ...(allowedOfferingIds ? { id: { in: [...allowedOfferingIds] } } : {}),
            },
            orderBy: [
                { term: { year: 'desc' } },
                { term: { session: 'asc' } },
                { subject: { subjectCode: 'asc' } },
            ],
            select: {
                id: true,
                subject: { select: { subjectCode: true, subjectName: true } },
                term: { select: { year: true, session: true } },
            },
        }),
    ]);

    const date = new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Australia/Sydney',
    });
    const people: PersonListItem[] = rows.map((row) => ({
        user: {
            id: row.id,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
        },
        assignments: row.roleAssignments.map((assignment) => ({
            id: assignment.id,
            role: {
                id: assignment.role.id,
                roleName: assignment.role.roleName,
                scopeType: assignment.role.scopeType,
                protected: assignment.role.roleCode === CHIEF_MANAGEMENT_ROLE_CODE,
            },
            scopes:
                scopeCapabilities?.view === false
                    ? []
                    : assignment.scopeAssignments
                          .map((scope) => ({
                              id: scope.id,
                              source: scope.source,
                              assignedBy: scope.assignedDirectlyBy
                                  ? `${scope.assignedDirectlyBy.firstName} ${scope.assignedDirectlyBy.lastName}`
                                  : null,
                              offering: scope.offering,
                          }))
                          .sort(
                              (left, right) =>
                                  right.offering.term.year - left.offering.term.year ||
                                  left.offering.term.session - right.offering.term.session ||
                                  left.offering.subject.subjectCode.localeCompare(
                                      right.offering.subject.subjectCode,
                                  ),
                          ),
            granted: date.format(assignment.roleGrantedAt),
            revoked: assignment.roleRevokedAt ? date.format(assignment.roleRevokedAt) : null,
            source: assignment.fromRequest ? 'REQUEST' : 'MANUAL',
        })),
    }));

    return (
        <PeopleTable
            people={people}
            users={users}
            roles={roles}
            offerings={offerings}
            roleId={roleId}
            offeringId={offeringId}
            status={status}
            page={page}
            pageCount={pageCountOf(total)}
            total={total}
            sort={sort}
            dir={dir}
            endpoint={endpoint}
            contextQuery={contextQuery}
            canManage={canManage}
            roleCapabilities={roleCapabilities}
            scopeCapabilities={scopeCapabilities}
            roleFilterParam={roleFilterParam}
            canManageProtectedRoles={allowProtectedRoles}
        />
    );
}
