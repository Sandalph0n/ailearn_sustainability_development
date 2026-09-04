import {
    ScopeRequestsTable,
    type ScopeRequestListItem,
} from '@/components/admin/requests/scope-requests-table';
import {
    PAGE_SIZE,
    pageCountOf,
    parseListParams,
    parseOptionalUuid,
} from '@/lib/admin/list-params';
import { db } from '@/lib/db';

const STATUS_VALUES = ['pending', 'approved', 'rejected', 'all'] as const;

export async function ScopeRequestsSection({
    institutionId,
    searchParams,
    actionBasePath,
    contextQuery,
    canReview,
    roleFilterParam = 'role',
}: {
    institutionId: string;
    searchParams: Record<string, string | string[] | undefined>;
    actionBasePath?: string;
    contextQuery?: string;
    canReview?: boolean;
    roleFilterParam?: string;
}) {
    const SORT_FIELDS = ['requested', 'user', 'role', 'subject', 'status'] as const;
    const { q, page, sort, dir, skip } = parseListParams(searchParams, SORT_FIELDS);
    const roleId = parseOptionalUuid(searchParams[roleFilterParam]);
    const rawStatus = Array.isArray(searchParams.status)
        ? searchParams.status[0]
        : searchParams.status;
    const status = STATUS_VALUES.includes(rawStatus as (typeof STATUS_VALUES)[number])
        ? (rawStatus as (typeof STATUS_VALUES)[number])
        : 'pending';

    const where = {
        offering: { subject: { institutionId } },
        ...(roleId ? { roleAssignment: { roleId } } : {}),
        ...(status === 'all'
            ? {}
            : { status: status.toUpperCase() as 'PENDING' | 'APPROVED' | 'REJECTED' }),
        ...(q
            ? {
                  OR: [
                      {
                          roleAssignment: {
                              user: { email: { contains: q, mode: 'insensitive' as const } },
                          },
                      },
                      {
                          roleAssignment: {
                              user: { firstName: { contains: q, mode: 'insensitive' as const } },
                          },
                      },
                      {
                          roleAssignment: {
                              user: { lastName: { contains: q, mode: 'insensitive' as const } },
                          },
                      },
                      {
                          roleAssignment: {
                              role: { roleName: { contains: q, mode: 'insensitive' as const } },
                          },
                      },
                      {
                          offering: {
                              subject: {
                                  subjectCode: { contains: q, mode: 'insensitive' as const },
                              },
                          },
                      },
                      {
                          offering: {
                              subject: {
                                  subjectName: { contains: q, mode: 'insensitive' as const },
                              },
                          },
                      },
                  ],
              }
            : {}),
    };

    const orderBy =
        sort === 'user'
            ? { roleAssignment: { user: { lastName: dir } } }
            : sort === 'role'
              ? { roleAssignment: { role: { roleName: dir } } }
              : sort === 'subject'
                ? { offering: { subject: { subjectCode: dir } } }
                : sort === 'status'
                  ? { status: dir }
                  : { requestedAt: dir };

    const [rows, total, roles] = await Promise.all([
        db.scopeAssignmentRequest.findMany({
            where,
            orderBy: [orderBy, { id: 'asc' }],
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                requestedAt: true,
                status: true,
                processedAt: true,
                roleAssignment: {
                    select: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                        role: { select: { id: true, roleName: true } },
                    },
                },
                offering: {
                    select: {
                        id: true,
                        subject: { select: { subjectCode: true, subjectName: true } },
                        term: { select: { year: true, session: true } },
                    },
                },
                processedBy: { select: { firstName: true, lastName: true } },
                approvedScopeAssignmentId: true,
            },
        }),
        db.scopeAssignmentRequest.count({ where }),
        db.role.findMany({
            where: { institutionId, scopeType: 'OFFERING' },
            orderBy: [{ roleName: 'asc' }, { id: 'asc' }],
            select: { id: true, roleName: true },
        }),
    ]);

    const date = new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Australia/Sydney',
    });
    const requests: ScopeRequestListItem[] = rows.map((row) => ({
        id: row.id,
        requested: date.format(row.requestedAt),
        status: row.status,
        processed: row.processedAt ? date.format(row.processedAt) : null,
        user: row.roleAssignment.user,
        role: row.roleAssignment.role,
        offering: {
            id: row.offering.id,
            subjectCode: row.offering.subject.subjectCode,
            subjectName: row.offering.subject.subjectName,
            year: row.offering.term.year,
            session: row.offering.term.session,
        },
        processedBy: row.processedBy
            ? `${row.processedBy.firstName} ${row.processedBy.lastName}`
            : null,
        approvedScopeAssignmentId: row.approvedScopeAssignmentId,
    }));

    return (
        <ScopeRequestsTable
            requests={requests}
            roles={roles}
            roleId={roleId}
            status={status}
            page={page}
            pageCount={pageCountOf(total)}
            total={total}
            sort={sort}
            dir={dir}
            actionBasePath={actionBasePath}
            contextQuery={contextQuery}
            canReview={canReview}
            roleFilterParam={roleFilterParam}
        />
    );
}
