'use client';

import { useMemo } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Cancel01Icon,
    CheckmarkCircle02Icon,
    MoreVerticalIcon,
} from '@hugeicons/core-free-icons';

import { ResourceActionDialog } from '@/components/admin/resource-action-dialog';
import { UrlSelectFilter } from '@/components/admin/url-select-filter';
import { useListQuery } from '@/components/admin/use-list-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, columnHelperFor, type AdminColumnDef } from '@/components/ui/data-table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

export type ScopeRequestListItem = {
    id: string;
    requested: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    processed: string | null;
    user: { id: string; firstName: string; lastName: string; email: string };
    role: { id: string; roleName: string };
    offering: {
        id: string;
        subjectCode: string;
        subjectName: string;
        year: number;
        session: number;
    };
    processedBy: string | null;
    approvedScopeAssignmentId: string | null;
};

const column = columnHelperFor<ScopeRequestListItem>();

const STATUS_BADGE = {
    PENDING: 'outline',
    APPROVED: 'default',
    REJECTED: 'secondary',
} as const;

export function ScopeRequestsTable({
    requests,
    roles,
    roleId,
    status,
    page,
    pageCount,
    total,
    sort,
    dir,
    actionBasePath = '/api/admin/scope-requests',
    contextQuery = '',
    canReview = true,
    roleFilterParam = 'role',
}: {
    requests: ScopeRequestListItem[];
    roles: Array<{ id: string; roleName: string }>;
    roleId: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'all';
    page: number;
    pageCount: number;
    total: number;
    sort: string;
    dir: 'asc' | 'desc';
    actionBasePath?: string;
    contextQuery?: string;
    canReview?: boolean;
    roleFilterParam?: string;
}) {
    const list = useListQuery();

    const columns = useMemo(
        () =>
            [
                column.accessor((row) => `${row.user.lastName}, ${row.user.firstName}`, {
                    id: 'user',
                    header: 'Person',
                    cell: (info) => (
                        <div className="flex flex-col">
                            <span className="font-medium">{info.getValue()}</span>
                            <span className="text-muted-foreground text-xs">
                                {info.row.original.user.email}
                            </span>
                        </div>
                    ),
                }),
                column.accessor((row) => row.role.roleName, {
                    id: 'role',
                    header: 'Access role',
                    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
                }),
                column.accessor((row) => row.offering.subjectCode, {
                    id: 'subject',
                    header: 'Subject offering',
                    cell: (info) => (
                        <div className="flex flex-col">
                            <span className="font-medium">
                                {info.getValue()} · {info.row.original.offering.subjectName}
                            </span>
                            <span className="text-muted-foreground text-xs">
                                Session {info.row.original.offering.session}{' '}
                                {info.row.original.offering.year}
                            </span>
                        </div>
                    ),
                }),
                column.accessor('requested', {
                    header: 'Requested',
                    cell: (info) => (
                        <span className="text-sm tabular-nums">{info.getValue()}</span>
                    ),
                }),
                column.accessor('status', {
                    header: 'Status',
                    cell: (info) => (
                        <div className="flex flex-col gap-0.5">
                            <Badge variant={STATUS_BADGE[info.getValue()]}>
                                {info.getValue()[0] + info.getValue().slice(1).toLowerCase()}
                            </Badge>
                            {info.row.original.processed && (
                                <span className="text-muted-foreground text-xs tabular-nums">
                                    {info.row.original.processedBy
                                        ? `${info.row.original.processedBy} · `
                                        : ''}
                                    {info.row.original.processed}
                                </span>
                            )}
                        </div>
                    ),
                }),
                ...(canReview
                    ? [
                          column.display({
                              id: 'actions',
                              header: '',
                              cell: (info) => (
                                  <ScopeRequestActions
                                      request={info.row.original}
                                      actionBasePath={actionBasePath}
                                      contextQuery={contextQuery}
                                  />
                              ),
                          }),
                      ]
                    : []),
            ] as Array<AdminColumnDef<ScopeRequestListItem>>,
        [actionBasePath, canReview, contextQuery],
    );

    return (
        <DataTable
            columns={columns}
            data={requests}
            emptyMessage={
                list.input || roleId || status !== 'pending'
                    ? 'No subject access requests match these filters.'
                    : 'No pending subject access requests.'
            }
            toolbar={
                <>
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search access requests…"
                        className="max-w-60"
                        aria-label="Search subject access requests"
                    />
                    <UrlSelectFilter
                        value={roleId}
                        options={roles.map((role) => ({ value: role.id, label: role.roleName }))}
                        placeholder="All offering roles"
                        ariaLabel="Filter by access role"
                        onChange={(next) =>
                            list.setParams({ [roleFilterParam]: next, page: null })
                        }
                    />
                    <UrlSelectFilter
                        value={status}
                        options={[
                            { value: 'pending', label: 'Pending only' },
                            { value: 'approved', label: 'Approved only' },
                            { value: 'rejected', label: 'Rejected only' },
                            { value: 'all', label: 'All history' },
                        ]}
                        placeholder="Pending only"
                        ariaLabel="Filter by request status"
                        clearable={false}
                        onChange={(next) =>
                            list.setParams({ status: next === 'pending' ? null : next, page: null })
                        }
                    />
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {total} total
                    </span>
                </>
            }
            server={{
                page,
                pageCount,
                sort,
                dir,
                pending: list.isPending,
                onSort: (columnId) =>
                    list.setParams({
                        sort: columnId,
                        dir: sort === columnId && dir === 'asc' ? 'desc' : 'asc',
                        page: null,
                    }),
                onPage: (next) => list.setParams({ page: next === 1 ? null : next }),
            }}
        />
    );
}

function ScopeRequestActions({
    request,
    actionBasePath,
    contextQuery,
}: {
    request: ScopeRequestListItem;
    actionBasePath: string;
    contextQuery: string;
}) {
    if (request.status !== 'PENDING') return null;
    const name = `${request.user.firstName} ${request.user.lastName}`;
    const offering = `${request.offering.subjectCode}, Session ${request.offering.session} ${request.offering.year}`;

    return (
        <div className="flex justify-end">
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button variant="ghost" size="icon-sm" aria-label="Open actions">
                            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
                        </Button>
                    }
                />
                <DropdownMenuContent align="end">
                    <ResourceActionDialog
                        endpoint={actionEndpoint(actionBasePath, request.id, 'approve', contextQuery)}
                        title={`Approve access to ${request.offering.subjectCode}?`}
                        description={`This gives ${name} access to ${offering} through their ${request.role.roleName} role.`}
                        confirmLabel="Approve access"
                        trigger={
                            <DropdownMenuItem closeOnClick={false}>
                                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                                Approve
                            </DropdownMenuItem>
                        }
                    />
                    <DropdownMenuSeparator />
                    <ResourceActionDialog
                        endpoint={actionEndpoint(actionBasePath, request.id, 'reject', contextQuery)}
                        title={`Reject access to ${request.offering.subjectCode}?`}
                        description={`This closes ${name}’s request without assigning the subject scope. The request remains in history.`}
                        confirmLabel="Reject access"
                        destructive
                        trigger={
                            <DropdownMenuItem variant="destructive" closeOnClick={false}>
                                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                                Reject
                            </DropdownMenuItem>
                        }
                    />
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function actionEndpoint(
    basePath: string,
    requestId: string,
    action: 'approve' | 'reject',
    query: string,
): string {
    return `${basePath}/${requestId}/${action}${query ? `?${query}` : ''}`;
}
