'use client';

import { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, Edit02Icon, MoreVerticalIcon } from '@hugeicons/core-free-icons';

import { DeleteResourceDialog } from '@/components/admin/delete-resource-dialog';
import {
    ResourceFormPage,
    ResourceFormSection,
} from '@/components/admin/resource-form-page';
import { useListQuery } from '@/components/admin/use-list-query';
import { FormInput } from '@/components/form';
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
import {
    EMPTY_TOOL_FORM,
    ToolSchema,
    type ToolFormValue,
    type ToolSchemaValue,
} from '@/lib/admin/tool-schema';

export type ToolListItem = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    codeBaseLocation: string | null;
    /** Số bài tập đã cho phép dùng công cụ này, và số phiên đã mở bằng nó. */
    counts: { assessments: number; sessions: number };
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
    const [editing, setEditing] = useState<ToolListItem | 'create' | null>(null);

    const columns = useMemo(
        () =>
            [
                column.accessor('name', {
                    header: 'Name',
                    cell: (info) => (
                        <div className="flex flex-col">
                            <span className="font-medium">{info.getValue()}</span>
                            {/* Mã hiện dưới tên bằng chữ máy đánh chữ — nó là định danh kỹ
                                thuật, xuất hiện nguyên văn trong URL của công cụ. */}
                            <span className="text-muted-foreground font-mono text-xs">
                                {info.row.original.code}
                            </span>
                        </div>
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

                column.accessor((row) => row.counts.assessments, {
                    id: 'assessments',
                    header: 'Assessments',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),

                column.accessor((row) => row.counts.sessions, {
                    id: 'sessions',
                    header: 'Sessions',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),

                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) => (
                        <RowActions
                            tool={info.row.original}
                            onEdit={() => setEditing(info.row.original)}
                        />
                    ),
                }),
            ] as Array<AdminColumnDef<ToolListItem>>,
        [],
    );

    if (editing) {
        return (
            <ToolForm
                tool={editing === 'create' ? undefined : editing}
                onCancel={() => setEditing(null)}
            />
        );
    }

    return (
        <DataTable
            columns={columns}
            data={tools}
            emptyMessage={
                list.input
                    ? `No tools match "${list.input}".`
                    : page > 1
                      ? `Page ${page} is past the end. There ${total === 1 ? 'is' : 'are'} only ${total}.`
                      : 'No tools yet. Create the first one.'
            }
            toolbar={
                <>
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search tools…"
                        className="max-w-xs"
                        aria-label="Search tools"
                    />
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {total} total
                    </span>
                    <div className="flex-1" />
                    <Button onClick={() => setEditing('create')}>
                        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                        New tool
                    </Button>
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

function ToolForm({ tool, onCancel }: { tool?: ToolListItem; onCancel: () => void }) {
    return (
        <ResourceFormPage<ToolFormValue, ToolSchemaValue>
            schema={ToolSchema}
            emptyValues={EMPTY_TOOL_FORM}
            editing={
                tool && {
                    id: tool.id,
                    values: {
                        code: tool.code,
                        name: tool.name,
                        // Ô nhập cần chuỗi; `null` khiến React coi là uncontrolled rồi cảnh báo.
                        description: tool.description ?? '',
                        codeBaseLocation: tool.codeBaseLocation ?? '',
                    },
                }
            }
            createEndpoint={ENDPOINT}
            title={{ create: 'New tool', edit: 'Edit tool' }}
            description={{
                create: 'A tool an assessment can hand to students.',
                edit: 'Changes apply everywhere this tool appears.',
            }}
            onCancel={onCancel}
        >
            {(form) => (
                <ResourceFormSection
                    title="Tool identity"
                    description="Name the tool, choose its permanent path code, and record where its independent codebase lives."
                >
                    <div className="grid gap-5 md:grid-cols-2">
                        <FormInput
                            control={form.control}
                            name="name"
                            label="Name"
                            placeholder="Code Workspace"
                            autoComplete="off"
                        />
                        <FormInput
                            control={form.control}
                            name="code"
                            label="Code"
                            description={
                                tool
                                    ? "Permanent identifier used in the tool's URL."
                                    : "Appears in the tool's URL and cannot change after creation."
                            }
                            placeholder="code"
                            autoComplete="off"
                            className="font-mono"
                            readOnly={Boolean(tool)}
                        />
                        <FormInput
                            control={form.control}
                            name="description"
                            label="Description"
                            description="Optional."
                            placeholder="What students do with it."
                            autoComplete="off"
                        />
                        <FormInput
                            control={form.control}
                            name="codeBaseLocation"
                            label="Code base"
                            description="Optional. Where the tool's source lives."
                            placeholder="https://github.com/…"
                            autoComplete="off"
                        />
                    </div>
                </ResourceFormSection>
            )}
        </ResourceFormPage>
    );
}

function RowActions({ tool, onEdit }: { tool: ToolListItem; onEdit: () => void }) {
    const inUse = tool.counts.assessments + tool.counts.sessions;

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
                    <DropdownMenuItem onClick={onEdit}>
                        <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                        Edit
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DeleteResourceDialog
                        endpoint={`${ENDPOINT}/${tool.id}`}
                        title={`Delete ${tool.name}?`}
                        description={
                            inUse > 0
                                ? 'This tool has been used in assessments or work sessions, so the database will refuse to delete it.'
                                : 'Nothing uses this tool yet. This cannot be undone.'
                        }
                        trigger={
                            <DropdownMenuItem variant="destructive" closeOnClick={false}>
                                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                                Delete
                            </DropdownMenuItem>
                        }
                    />
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
