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

export type RequestListItem = {
    id: string;
    requested: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    processed: string | null;
    user: { id: string; firstName: string; lastName: string; email: string };
    role: { id: string; roleName: string };
    processedBy: string | null;
    approvedAssignmentId: string | null;
};

const column = columnHelperFor<RequestListItem>();

const STATUS_BADGE = {
    PENDING: 'outline',
    APPROVED: 'default',
    REJECTED: 'secondary',
} as const;

export function RequestsTable({
    requests,
    roles,
    roleId,
    status,
    page,
    pageCount,
    total,
    sort,
    dir,
}: {
    requests: RequestListItem[];
    roles: Array<{ id: string; roleName: string }>;
    roleId: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'all';
    page: number;
    pageCount: number;
    total: number;
    sort: string;
    dir: 'asc' | 'desc';
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
                    header: 'Requested role',
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
                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) => <RequestActions request={info.row.original} />,
                }),
            ] as Array<AdminColumnDef<RequestListItem>>,
        [],
    );

    return (
        <DataTable
            columns={columns}
            data={requests}
            emptyMessage={
                list.input || roleId || status !== 'pending'
                    ? 'No join requests match these filters.'
                    : 'No pending join requests.'
            }
            toolbar={
                <>
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search requests…"
                        className="max-w-52"
                        aria-label="Search join requests"
                    />
                    <UrlSelectFilter
                        value={roleId}
                        options={roles.map((role) => ({ value: role.id, label: role.roleName }))}
                        placeholder="All roles"
                        ariaLabel="Filter by requested role"
                        onChange={(next) => list.setParams({ role: next, page: null })}
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

function RequestActions({ request }: { request: RequestListItem }) {
    if (request.status !== 'PENDING') return null;
    const name = `${request.user.firstName} ${request.user.lastName}`;

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
                        endpoint={`/api/admin/role-requests/${request.id}/approve`}
                        title={`Approve ${request.role.roleName}?`}
                        description={`This grants ${request.role.roleName} to ${name} institution-wide.`}
                        confirmLabel="Approve request"
                        trigger={
                            <DropdownMenuItem closeOnClick={false}>
                                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                                Approve
                            </DropdownMenuItem>
                        }
                    />
                    <DropdownMenuSeparator />
                    <ResourceActionDialog
                        endpoint={`/api/admin/role-requests/${request.id}/reject`}
                        title={`Reject ${request.role.roleName}?`}
                        description={`This closes ${name}’s request without granting a role. The request remains in history.`}
                        confirmLabel="Reject request"
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
