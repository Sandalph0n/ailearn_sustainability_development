'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    Calendar03Icon,
    Delete02Icon,
    Edit02Icon,
    MoreVerticalIcon,
} from '@hugeicons/core-free-icons';

import { DeleteResourceDialog } from '@/components/admin/delete-resource-dialog';
import {
    InstitutionFilter,
    institutionItems,
    type InstitutionOption,
} from '@/components/admin/institution-filter';
import {
    ResourceFormPage,
    ResourceFormSection,
} from '@/components/admin/resource-form-page';
import { useListQuery } from '@/components/admin/use-list-query';
import { FormInput, FormSelect } from '@/components/form';
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
import { SelectItem } from '@/components/ui/select';
import {
    EMPTY_TERM_FORM,
    TermSchema,
    type TermFormValue,
    type TermSchemaValue,
} from '@/lib/admin/term-schema';

export type TermListItem = {
    id: string;
    year: number;
    session: number;
    institution: { id: string; name: string };
    counts: { periods: number; offerings: number };
    /** Khoảng ngày kéo dài của kỳ, đã định dạng ở server. `null` khi chưa khai giai đoạn nào. */
    span: string | null;
};

const column = columnHelperFor<TermListItem>();
const ENDPOINT = '/api/admin/terms';

export function TermsTable({
    terms,
    institutions,
    institutionId,
    locked,
    page,
    pageCount,
    total,
    sort,
    dir,
}: {
    terms: TermListItem[];
    institutions: InstitutionOption[];
    institutionId: string | null;
    /** Đang ở trang con của một cơ sở: cột và bộ lọc cơ sở đều thừa. */
    locked: boolean;
    page: number;
    pageCount: number;
    total: number;
    sort: string;
    dir: 'asc' | 'desc';
}) {
    const list = useListQuery();
    const [editing, setEditing] = useState<TermListItem | 'create' | null>(null);

    const columns = useMemo(
        () =>
            [
                column.accessor('year', {
                    header: 'Term',
                    cell: (info) => (
                        <Link
                            href={`/admin/institutions/${info.row.original.institution.id}/terms/${info.row.original.id}`}
                            className="hover:text-primary font-medium tabular-nums transition-colors"
                        >
                            {info.getValue()} · Session {info.row.original.session}
                        </Link>
                    ),
                }),

                ...(locked
                    ? []
                    : [
                          column.accessor((row) => row.institution.name, {
                              id: 'institution',
                              header: 'Institution',
                              cell: (info) => (
                                  <span className="text-muted-foreground text-sm">
                                      {info.getValue()}
                                  </span>
                              ),
                          }),
                      ]),

                column.accessor('span', {
                    header: 'Runs',
                    enableSorting: false,
                    cell: (info) => (
                        <span className="text-muted-foreground text-sm">
                            {info.getValue() ?? 'No periods set'}
                        </span>
                    ),
                }),

                column.accessor((row) => row.counts.periods, {
                    id: 'periods',
                    header: 'Periods',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),

                column.accessor((row) => row.counts.offerings, {
                    id: 'offerings',
                    header: 'Offerings',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),

                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) => (
                        <RowActions
                            term={info.row.original}
                            onEdit={() => setEditing(info.row.original)}
                        />
                    ),
                }),
            ] as Array<AdminColumnDef<TermListItem>>,
        [locked],
    );

    if (editing) {
        return (
            <TermForm
                term={editing === 'create' ? undefined : editing}
                institutions={institutions}
                presetInstitutionId={institutionId}
                locked={locked}
                onCancel={() => setEditing(null)}
            />
        );
    }

    return (
        <DataTable
            columns={columns}
            data={terms}
            emptyMessage={
                list.input
                    ? `No terms match "${list.input}".`
                    : institutionId
                      ? 'This institution has no terms yet.'
                      : page > 1
                        ? `Page ${page} is past the end. There ${total === 1 ? 'is' : 'are'} only ${total}.`
                        : 'No terms yet. Create the first one.'
            }
            toolbar={
                <>
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search by year…"
                        className="max-w-40"
                        aria-label="Search terms by year"
                    />
                    {!locked && (
                        <InstitutionFilter
                            institutions={institutions}
                            value={institutionId}
                            onChange={(next) =>
                                list.setParams({ institution: next, page: null })
                            }
                        />
                    )}
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {total} total
                    </span>
                    <div className="flex-1" />
                    <Button onClick={() => setEditing('create')}>
                        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                        New term
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

function TermForm({
    term,
    institutions,
    presetInstitutionId,
    locked = false,
    onCancel,
}: {
    term?: TermListItem;
    institutions: InstitutionOption[];
    presetInstitutionId?: string | null;
    locked?: boolean;
    onCancel: () => void;
}) {
    return (
        <ResourceFormPage<TermFormValue, TermSchemaValue>
            schema={TermSchema}
            emptyValues={{ ...EMPTY_TERM_FORM, institutionId: presetInstitutionId ?? '' }}
            editing={
                term && {
                    id: term.id,
                    values: {
                        institutionId: term.institution.id,
                        // Ô nhập luôn giữ chuỗi; `z.coerce.number()` lo phần chuyển đổi.
                        year: String(term.year),
                        session: String(term.session),
                    } as unknown as TermFormValue,
                }
            }
            createEndpoint={ENDPOINT}
            title={{ create: 'New term', edit: 'Edit term' }}
            description={{
                create: 'A year and session that subjects run in.',
                edit: 'Changes apply to every offering in this term.',
            }}
            onCancel={onCancel}
        >
            {(form) => (
                <ResourceFormSection
                    title="Study term"
                    description="Identify this teaching window by year and its institution-specific session number."
                >
                    <div className="grid gap-5 md:grid-cols-2">
                        {!locked && (
                            <div className="md:col-span-2">
                                <FormSelect
                                    control={form.control}
                                    name="institutionId"
                                    label="Institution"
                                    items={institutionItems(institutions)}
                                    description="A year and session can only exist once per institution."
                                >
                                    {institutions.map((institution) => (
                                        <SelectItem key={institution.id} value={institution.id}>
                                            {institution.name}
                                        </SelectItem>
                                    ))}
                                </FormSelect>
                            </div>
                        )}
                        <FormInput
                            control={form.control}
                            name="year"
                            label="Year"
                            type="number"
                            inputMode="numeric"
                            placeholder="2026"
                            autoComplete="off"
                        />
                        <FormInput
                            control={form.control}
                            name="session"
                            label="Session"
                            description="A number, not a name — institutions call it session, semester or trimester."
                            type="number"
                            inputMode="numeric"
                            placeholder="1"
                            autoComplete="off"
                        />
                    </div>
                </ResourceFormSection>
            )}
        </ResourceFormPage>
    );
}

function RowActions({
    term,
    onEdit,
}: {
    term: TermListItem;
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
                    <DropdownMenuItem
                        render={
                            <Link
                                href={`/admin/institutions/${term.institution.id}/terms/${term.id}`}
                            />
                        }
                    >
                        <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
                        Manage periods
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={onEdit}>
                        <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                        Edit
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DeleteResourceDialog
                        endpoint={`${ENDPOINT}/${term.id}`}
                        title={`Delete ${term.year} session ${term.session}?`}
                        description={
                            term.counts.offerings > 0
                                ? `This also deletes ${term.counts.periods} period${term.counts.periods === 1 ? '' : 's'} and ${term.counts.offerings} offering${term.counts.offerings === 1 ? '' : 's'}. If any student work exists, the database will refuse.`
                                : 'This term has no offerings. This cannot be undone.'
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
