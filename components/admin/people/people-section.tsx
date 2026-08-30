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
}: {
    institutionId: string;
    searchParams: Record<string, string | string[] | undefined>;
}) {
    const SORT_FIELDS = ['user', 'role', 'granted'] as const;
    const { q, page, sort, dir, skip } = parseListParams(searchParams, SORT_FIELDS);
    const roleId = parseOptionalUuid(searchParams.role);
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
        ...(offeringId ? { offeringId } : {}),
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
                offering: {
                    select: {
                        id: true,
                        subject: { select: { subjectCode: true } },
                        term: { select: { year: true, session: true } },
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
    const assignments: AssignmentListItem[] = rows.map((row) => ({
        id: row.id,
        user: row.user,
        role: row.role,
        offering: row.offering,
        granted: date.format(row.roleGrantedAt),
        revoked: row.roleRevokedAt ? date.format(row.roleRevokedAt) : null,
        source: row.fromRequest ? 'REQUEST' : 'MANUAL',
    }));

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
        />
    );
}
