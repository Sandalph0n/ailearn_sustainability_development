'use client';

import { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    Delete02Icon,
    Edit02Icon,
    MoreVerticalIcon,
} from '@hugeicons/core-free-icons';

import { DeleteResourceDialog } from '@/components/admin/delete-resource-dialog';
import {
    ResourceFormPage,
    ResourceFormSection,
} from '@/components/admin/resource-form-page';
import { FormInput, FormSelect } from '@/components/form';
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
import { SelectItem } from '@/components/ui/select';
import {
    EMPTY_TERM_PERIOD_FORM,
    TermPeriodSchema,
    type TermPeriodFormValue,
    type TermPeriodSchemaValue,
} from '@/lib/admin/term-period-schema';

export type TermPeriodListItem = {
    id: string;
    name: string;
    type: 'TEACHING' | 'BREAK' | 'EXAM';
    startAt: string;
    endAt: string;
    starts: string;
    ends: string;
};

const column = columnHelperFor<TermPeriodListItem>();

const TYPE_LABELS = {
    TEACHING: 'Teaching',
    BREAK: 'Break',
    EXAM: 'Exam',
} as const;

/** Chuyển ISO instant về chuỗi mà input `datetime-local` hiểu, theo múi giờ trình duyệt. */
function toLocalInput(iso: string): string {
    const date = new Date(iso);
    const part = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

export function PeriodsTable({
    periods,
    termId,
}: {
    periods: TermPeriodListItem[];
    termId: string;
}) {
    const endpoint = `/api/admin/terms/${termId}/periods`;
    const [editing, setEditing] = useState<TermPeriodListItem | 'create' | null>(null);

    const columns = useMemo(
        () =>
            [
                column.accessor('name', {
                    header: 'Period',
                    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
                }),
                column.accessor('type', {
                    header: 'Type',
                    cell: (info) => (
                        <Badge variant={info.getValue() === 'TEACHING' ? 'default' : 'secondary'}>
                            {TYPE_LABELS[info.getValue()]}
                        </Badge>
                    ),
                }),
                column.accessor('starts', {
                    header: 'Starts',
                    cell: (info) => (
                        <span className="text-muted-foreground text-sm tabular-nums">
                            {info.getValue()}
                        </span>
                    ),
                }),
                column.accessor('ends', {
                    header: 'Ends',
                    cell: (info) => (
                        <span className="text-muted-foreground text-sm tabular-nums">
                            {info.getValue()}
                        </span>
                    ),
                }),
                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) => (
                        <PeriodActions
                            period={info.row.original}
                            endpoint={endpoint}
                            onEdit={() => setEditing(info.row.original)}
                        />
                    ),
                }),
            ] as Array<AdminColumnDef<TermPeriodListItem>>,
        [endpoint],
    );

    if (editing) {
        return (
            <PeriodForm
                endpoint={endpoint}
                period={editing === 'create' ? undefined : editing}
                onCancel={() => setEditing(null)}
            />
        );
    }

    return (
        <DataTable
            columns={columns}
            data={periods}
            pageSize={20}
            emptyMessage="No periods yet. Add teaching, break or exam dates to define this term."
            toolbar={
                <Button onClick={() => setEditing('create')}>
                    <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                    New period
                </Button>
            }
        />
    );
}

function PeriodForm({
    endpoint,
    period,
    onCancel,
}: {
    endpoint: string;
    period?: TermPeriodListItem;
    onCancel: () => void;
}) {
    return (
        <ResourceFormPage<TermPeriodFormValue, TermPeriodSchemaValue>
            schema={TermPeriodSchema}
            emptyValues={EMPTY_TERM_PERIOD_FORM}
            editing={
                period && {
                    id: period.id,
                    values: {
                        name: period.name,
                        type: period.type,
                        startAt: toLocalInput(period.startAt),
                        endAt: toLocalInput(period.endAt),
                    },
                }
            }
            createEndpoint={endpoint}
            title={{ create: 'New period', edit: 'Edit period' }}
            description={{
                create: 'A teaching, break or exam window inside this term.',
                edit: 'Update this period without changing the rest of the term.',
            }}
            onCancel={onCancel}
        >
            {(form) => (
                <ResourceFormSection
                    title="Calendar window"
                    description="Name the period, classify it, and set the exact boundaries used by this term."
                >
                    <div className="grid gap-5 md:grid-cols-2">
                        <FormInput
                            control={form.control}
                            name="name"
                            label="Name"
                            placeholder="Teaching weeks 1–7"
                            autoComplete="off"
                        />
                        <FormSelect control={form.control} name="type" label="Type">
                            <SelectItem value="TEACHING">Teaching</SelectItem>
                            <SelectItem value="BREAK">Break</SelectItem>
                            <SelectItem value="EXAM">Exam</SelectItem>
                        </FormSelect>
                        <FormInput
                            control={form.control}
                            name="startAt"
                            label="Starts"
                            type="datetime-local"
                        />
                        <FormInput
                            control={form.control}
                            name="endAt"
                            label="Ends"
                            type="datetime-local"
                        />
                    </div>
                </ResourceFormSection>
            )}
        </ResourceFormPage>
    );
}

function PeriodActions({
    period,
    endpoint,
    onEdit,
}: {
    period: TermPeriodListItem;
    endpoint: string;
    onEdit: () => void;
}) {
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
                        endpoint={`${endpoint}/${period.id}`}
                        title={`Delete ${period.name}?`}
                        description="This removes the period from the term calendar. This cannot be undone."
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
