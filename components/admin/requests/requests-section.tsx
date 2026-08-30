import { RequestsTable, type RequestListItem } from '@/components/admin/requests/requests-table';
import {
    PAGE_SIZE,
    pageCountOf,
    parseListParams,
    parseOptionalUuid,
} from '@/lib/admin/list-params';
import { db } from '@/lib/db';

const STATUS_VALUES = ['pending', 'approved', 'rejected', 'all'] as const;

export async function RequestsSection({
    institutionId,
    searchParams,
}: {
    institutionId: string;
    searchParams: Record<string, string | string[] | undefined>;
}) {
    const SORT_FIELDS = ['requested', 'user', 'role', 'status'] as const;
    const { q, page, sort, dir, skip } = parseListParams(searchParams, SORT_FIELDS);
    const roleId = parseOptionalUuid(searchParams.role);
    const rawStatus = Array.isArray(searchParams.status)
        ? searchParams.status[0]
        : searchParams.status;
    const status = STATUS_VALUES.includes(rawStatus as (typeof STATUS_VALUES)[number])
        ? (rawStatus as (typeof STATUS_VALUES)[number])
        : 'pending';

    const where = {
        institutionId,
        ...(roleId ? { roleId } : {}),
        ...(status === 'all' ? {} : { status: status.toUpperCase() as 'PENDING' | 'APPROVED' | 'REJECTED' }),
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
        sort === 'user'
            ? { user: { lastName: dir } }
            : sort === 'role'
              ? { role: { roleName: dir } }
              : sort === 'status'
                ? { status: dir }
                : { requestedAt: dir };

    const [rows, total, roles] = await Promise.all([
        db.roleRequest.findMany({
            where,
            orderBy: [orderBy, { id: 'asc' }],
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                requestedAt: true,
                status: true,
                processedAt: true,
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                role: { select: { id: true, roleName: true } },
                processedBy: { select: { firstName: true, lastName: true } },
                approvedAssignmentId: true,
            },
        }),
        db.roleRequest.count({ where }),
        db.role.findMany({
            where: { institutionId, scopeType: 'INSTITUTION' },
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
    const requests: RequestListItem[] = rows.map((row) => ({
        id: row.id,
        requested: date.format(row.requestedAt),
        status: row.status,
        processed: row.processedAt ? date.format(row.processedAt) : null,
        user: row.user,
        role: row.role,
        processedBy: row.processedBy
            ? `${row.processedBy.firstName} ${row.processedBy.lastName}`
            : null,
        approvedAssignmentId: row.approvedAssignmentId,
    }));

    return (
        <RequestsTable
            requests={requests}
            roles={roles}
            roleId={roleId}
            status={status}
            page={page}
            pageCount={pageCountOf(total)}
            total={total}
            sort={sort}
            dir={dir}
        />
    );
}
