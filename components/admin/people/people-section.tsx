import { PeopleTable, type AssignmentListItem } from '@/components/admin/people/people-table';
import {
    PAGE_SIZE,
    pageCountOf,
    parseListParams,
    parseOptionalUuid,
} from '@/lib/admin/list-params';
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
}: {
    institutionId: string;
    searchParams: Record<string, string | string[] | undefined>;
    endpoint?: string;
    contextQuery?: string;
    canManage?: boolean;
    roleCapabilities?: { create: boolean; revoke: boolean };
    scopeCapabilities?: { view: boolean; create: boolean; revoke: boolean };
    roleFilterParam?: string;
}) {
    const SORT_FIELDS = ['user', 'role', 'granted'] as const;
    const { q, page, sort, dir, skip } = parseListParams(searchParams, SORT_FIELDS);
    const roleId = parseOptionalUuid(searchParams[roleFilterParam]);
    const offeringId = parseOptionalUuid(searchParams.offering);
    const rawStatus = Array.isArray(searchParams.status)
        ? searchParams.status[0]
        : searchParams.status;
    const status = STATUS_VALUES.includes(rawStatus as (typeof STATUS_VALUES)[number])
        ? (rawStatus as (typeof STATUS_VALUES)[number])
        : 'active';

    const where = {
        role: { institutionId },
        ...(roleId ? { roleId } : {}),
        ...(offeringId ? { scopeAssignments: { some: { offeringId, revokedAt: null } } } : {}),
        ...(status === 'active'
            ? { roleRevokedAt: null }
            : status === 'revoked'
              ? { roleRevokedAt: { not: null } }
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

    const orderBy =
        sort === 'role'
            ? { role: { roleName: dir } }
            : sort === 'granted'
              ? { roleGrantedAt: dir }
              : { user: { lastName: dir } };

    const [rows, total, users, roles, offerings] = await Promise.all([
        db.roleAssignment.findMany({
            where,
            orderBy: [orderBy, { id: 'asc' }],
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                roleGrantedAt: true,
                roleRevokedAt: true,
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                role: { select: { id: true, roleName: true, scopeType: true } },
                scopeAssignments: {
                    where: { revokedAt: null },
                    select: {
                        id: true,
                        source: true,
                        assignedDirectlyBy: {
                            select: { firstName: true, lastName: true },
                        },
                        offering: {
                            select: {
                                id: true,
                                subject: { select: { subjectCode: true } },
                                term: { select: { year: true, session: true } },
                            },
                        },
                    },
                },
                fromRequest: { select: { id: true } },
            },
        }),
        db.roleAssignment.count({ where }),
        db.user.findMany({
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
            select: { id: true, firstName: true, lastName: true, email: true },
        }),
        db.role.findMany({
            where: { institutionId },
            orderBy: [{ roleName: 'asc' }, { id: 'asc' }],
            select: { id: true, roleName: true, scopeType: true },
        }),
        db.offering.findMany({
            where: { subject: { institutionId } },
            orderBy: [
                { term: { year: 'desc' } },
                { term: { session: 'asc' } },
                { subject: { subjectCode: 'asc' } },
            ],
            select: {
                id: true,
                subject: { select: { subjectCode: true } },
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
    const assignments: AssignmentListItem[] = rows.map((row) => {
        const scopes = row.scopeAssignments
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
            );

        return {
            id: row.id,
            user: row.user,
            role: row.role,
            scopes: scopeCapabilities?.view === false ? [] : scopes,
            granted: date.format(row.roleGrantedAt),
            revoked: row.roleRevokedAt ? date.format(row.roleRevokedAt) : null,
            source: row.fromRequest ? 'REQUEST' : 'MANUAL',
        };
    });

    return (
        <PeopleTable
            assignments={assignments}
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
        />
    );
}
