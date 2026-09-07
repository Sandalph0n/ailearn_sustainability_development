'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    Delete02Icon,
    Edit02Icon,
    MoreVerticalIcon,
    PackageIcon,
} from '@hugeicons/core-free-icons';

import { DeleteResourceDialog } from '@/components/admin/delete-resource-dialog';
import { useListQuery } from '@/components/admin/use-list-query';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { DataTable, columnHelperFor, type AdminColumnDef } from '@/components/ui/data-table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

export type ToolListItem = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    activeVersion: { id: string; version: string } | null;
    counts: { versions: number; assessments: number; sessions: number };
};

const column = columnHelperFor<ToolListItem>();
const ENDPOINT = '/api/admin/tools';

export function ToolsTable({
    tools,
    page,
    pageCount,
    total,
    sort,
    dir,
}: {
    tools: ToolListItem[];
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
                column.accessor('name', {
                    header: 'Tool',
                    cell: (info) => (
                        <Link href={`/admin/tools/${info.row.original.id}`} className="group flex flex-col">
                            <span className="font-medium underline-offset-4 group-hover:underline">
                                {info.getValue()}
                            </span>
                            <span className="text-muted-foreground font-mono text-xs">
                                {info.row.original.code}
                            </span>
                        </Link>
                    ),
                }),
                column.accessor('description', {
                    header: 'Description',
                    enableSorting: false,
                    cell: (info) => (
                        <span className="text-muted-foreground line-clamp-2 max-w-md text-sm">
                            {info.getValue() ?? '—'}
                        </span>
                    ),
                }),
                column.accessor((row) => row.activeVersion?.version ?? '', {
                    id: 'activeVersion',
                    header: 'Active version',
                    enableSorting: false,
                    cell: (info) =>
                        info.getValue() ? (
                            <Badge variant="outline" className="font-mono">v{info.getValue()}</Badge>
                        ) : (
                            <span className="text-muted-foreground text-sm">Not deployed</span>
                        ),
                }),
                column.accessor((row) => row.counts.versions, {
                    id: 'versions',
                    header: 'Versions',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),
                column.accessor((row) => row.counts.assessments, {
                    id: 'assessments',
                    header: 'Assessments',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),
                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) => <RowActions tool={info.row.original} />,
                }),
            ] as Array<AdminColumnDef<ToolListItem>>,
        [],
    );

    return (
        <DataTable
            columns={columns}
            data={tools}
            emptyMessage={
                list.input
                    ? `No tools match "${list.input}".`
                    : page > 1
                      ? `Page ${page} is past the end.`
                      : 'No tools yet. Upload the first package.'
            }
            toolbar={
                <>
                    <Input value={list.input} onChange={(event) => list.setInput(event.target.value)} placeholder="Search tools…" className="max-w-xs" aria-label="Search tools" />
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">{total} total</span>
                    <div className="flex-1" />
                    <Link href="/admin/tools/new" className={buttonVariants()}>
                        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                        New tool
                    </Link>
                </>
            }
            server={{
                page,
                pageCount,
                sort,
                dir,
                pending: list.isPending,
                onSort: (columnId) => list.setParams({ sort: columnId, dir: sort === columnId && dir === 'asc' ? 'desc' : 'asc', page: null }),
                onPage: (next) => list.setParams({ page: next === 1 ? null : next }),
            }}
        />
    );
}

function RowActions({ tool }: { tool: ToolListItem }) {
    const inUse = tool.counts.assessments + tool.counts.sessions + tool.counts.versions;
    return (
        <div className="flex justify-end">
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Open actions"><HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} /></Button>} />
                <DropdownMenuContent align="end">
                    <DropdownMenuItem render={<Link href={`/admin/tools/${tool.id}`} />}>
                        <HugeiconsIcon icon={PackageIcon} strokeWidth={2} /> Manage versions
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={`/admin/tools/${tool.id}/edit`} />}>
                        <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} /> Edit details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DeleteResourceDialog
                        endpoint={`${ENDPOINT}/${tool.id}`}
                        title={`Delete ${tool.name}?`}
                        description={inUse > 0 ? 'This tool has versions or usage history, so the database will refuse to delete it.' : 'Nothing uses this tool yet. This cannot be undone.'}
                        trigger={<DropdownMenuItem variant="destructive" closeOnClick={false}><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} /> Delete</DropdownMenuItem>}
                    />
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
