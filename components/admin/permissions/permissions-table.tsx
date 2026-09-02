'use client';

import { useMemo } from 'react';

import type { PermissionType } from '@/app/generated/prisma/enums';
import { useListQuery } from '@/components/admin/use-list-query';
import { Badge } from '@/components/ui/badge';
import { DataTable, columnHelperFor, type AdminColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';

export type PermissionListItem = {
    id: string;
    permission: string;
    type: PermissionType;
    description: string | null;
    activeRoles: number;
};

const column = columnHelperFor<PermissionListItem>();

/**
 * Bảng chỉ đọc. Client boundary chỉ tồn tại để ô tìm kiếm, sắp xếp và phân trang có thể cập nhật
 * URL; dữ liệu vẫn được truy vấn ở Server Component và truyền xuống qua props.
 */
export function PermissionsTable({
    permissions,
    page,
    pageCount,
    total,
    sort,
    dir,
}: {
    permissions: PermissionListItem[];
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
                column.accessor('permission', {
                    header: 'Permission',
                    cell: (info) => (
                        <span className="font-mono text-xs font-medium">{info.getValue()}</span>
                    ),
                }),

                column.accessor('type', {
                    header: 'Applies to',
                    cell: (info) => (
                        <Badge variant="outline">
                            {info.getValue() === 'I' ? 'Institution' : 'Institution / Offering'}
                        </Badge>
                    ),
                }),

                column.accessor('description', {
                    header: 'Description',
                    cell: (info) => (
                        <span className="text-muted-foreground line-clamp-2 max-w-2xl text-sm">
                            {info.getValue() ?? '—'}
                        </span>
                    ),
                }),

                column.accessor('activeRoles', {
                    header: 'Active roles',
                    enableSorting: false,
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),
            ] as Array<AdminColumnDef<PermissionListItem>>,
        [],
    );

    return (
        <DataTable
            columns={columns}
            data={permissions}
            emptyMessage={
                list.input
                    ? `No permissions match "${list.input}".`
                    : page > 1
                      ? `Page ${page} is past the end. There ${total === 1 ? 'is' : 'are'} only ${total}.`
                      : 'No permissions have been registered by the platform yet.'
            }
            toolbar={
                <>
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search permissions…"
                        className="max-w-xs"
                        aria-label="Search permissions"
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
