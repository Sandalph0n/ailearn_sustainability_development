'use client';

import Link from 'next/link';
import { useMemo, type ReactElement } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    ArrowRight01Icon,
    Delete02Icon,
    Edit02Icon,
    MoreVerticalIcon,
} from '@hugeicons/core-free-icons';

import { DeleteResourceDialog } from '@/components/admin/delete-resource-dialog';
import { ResourceFormDialog } from '@/components/admin/resource-form-dialog';
import { UrlSelectFilter } from '@/components/admin/url-select-filter';
import { useListQuery } from '@/components/admin/use-list-query';
import { FormSelect } from '@/components/form';
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
    EMPTY_OFFERING_FORM,
    OfferingSchema,
    type OfferingFormValue,
    type OfferingSchemaValue,
} from '@/lib/admin/offering-schema';

type SubjectOption = { id: string; subjectCode: string; subjectName: string };
type TermOption = { id: string; year: number; session: number };

export type OfferingListItem = {
    id: string;
    subject: SubjectOption;
    term: TermOption;
    counts: { assessments: number; assignments: number };
};

const column = columnHelperFor<OfferingListItem>();
const ENDPOINT = '/api/admin/offerings';

const subjectItems = (subjects: SubjectOption[]) =>
    Object.fromEntries(
        subjects.map((subject) => [subject.id, `${subject.subjectCode} · ${subject.subjectName}`]),
    );
const termItems = (terms: TermOption[]) =>
    Object.fromEntries(
        terms.map((term) => [term.id, `${term.year} · Session ${term.session}`]),
    );

export function OfferingsTable({
    offerings,
    institutionId,
    subjects,
    terms,
    subjectId,
    termId,
    page,
    pageCount,
    total,
    sort,
    dir,
}: {
    offerings: OfferingListItem[];
    institutionId: string;
    subjects: SubjectOption[];
    terms: TermOption[];
    subjectId: string | null;
    termId: string | null;
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
                column.accessor((row) => row.subject.subjectCode, {
                    id: 'subject',
                    header: 'Subject',
                    cell: (info) => (
                        <Link
                            href={`/admin/institutions/${institutionId}/offerings/${info.row.original.id}`}
                            className="hover:text-primary flex flex-col transition-colors"
                        >
                            <span className="font-mono text-sm font-medium">{info.getValue()}</span>
                            <span className="text-muted-foreground text-xs">
                                {info.row.original.subject.subjectName}
                            </span>
                        </Link>
                    ),
                }),
                column.accessor((row) => row.term.year, {
                    id: 'term',
                    header: 'Term',
                    cell: (info) => (
                        <span className="tabular-nums">
                            {info.getValue()} · Session {info.row.original.term.session}
                        </span>
                    ),
                }),
                column.accessor((row) => row.counts.assessments, {
                    id: 'assessments',
                    header: 'Assessments',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),
                column.accessor((row) => row.counts.assignments, {
                    id: 'assignments',
                    header: 'Active people',
                    enableSorting: false,
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),
                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) => (
                        <OfferingActions
                            offering={info.row.original}
                            institutionId={institutionId}
                            subjects={subjects}
                            terms={terms}
                        />
                    ),
                }),
            ] as Array<AdminColumnDef<OfferingListItem>>,
        [institutionId, subjects, terms],
    );

    const canCreate = subjects.length > 0 && terms.length > 0;

    return (
        <DataTable
            columns={columns}
            data={offerings}
            emptyMessage={
                list.input || subjectId || termId
                    ? 'No offerings match these filters.'
                    : 'No offerings yet. Connect a subject to a study term.'
            }
            toolbar={
                <>
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search offerings…"
                        className="max-w-52"
                        aria-label="Search offerings"
                    />
                    <UrlSelectFilter
                        value={subjectId}
                        options={subjects.map((subject) => ({
                            value: subject.id,
                            label: subject.subjectCode,
                        }))}
                        placeholder="All subjects"
                        ariaLabel="Filter by subject"
                        onChange={(next) => list.setParams({ subject: next, page: null })}
                    />
                    <UrlSelectFilter
                        value={termId}
                        options={terms.map((term) => ({
                            value: term.id,
                            label: `${term.year} · S${term.session}`,
                        }))}
                        placeholder="All terms"
                        ariaLabel="Filter by term"
                        onChange={(next) => list.setParams({ term: next, page: null })}
                    />
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {total} total
                    </span>
                    <div className="flex-1" />
                    <OfferingDialog
                        subjects={subjects}
                        terms={terms}
                        trigger={
                            <Button disabled={!canCreate}>
                                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                                New offering
                            </Button>
                        }
                    />
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

function OfferingDialog({
    offering,
    subjects,
    terms,
    trigger,
}: {
    offering?: OfferingListItem;
    subjects: SubjectOption[];
    terms: TermOption[];
    trigger: ReactElement;
}) {
    return (
        <ResourceFormDialog<OfferingFormValue, OfferingSchemaValue>
            schema={OfferingSchema}
            emptyValues={EMPTY_OFFERING_FORM}
            editing={
                offering && {
                    id: offering.id,
                    values: { subjectId: offering.subject.id, termId: offering.term.id },
                }
            }
            createEndpoint={ENDPOINT}
            title={{ create: 'New offering', edit: 'Edit offering' }}
            description={{
                create: 'Choose which subject runs in which study term.',
                edit: 'An offering with content or assignment history cannot be moved.',
            }}
            trigger={trigger}
            fields={(form) => (
                <>
                    <FormSelect
                        control={form.control}
                        name="subjectId"
                        label="Subject"
                        items={subjectItems(subjects)}
                    >
                        {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                                {subject.subjectCode} · {subject.subjectName}
                            </SelectItem>
                        ))}
                    </FormSelect>
                    <FormSelect
                        control={form.control}
                        name="termId"
                        label="Study term"
                        items={termItems(terms)}
                    >
                        {terms.map((term) => (
                            <SelectItem key={term.id} value={term.id}>
                                {term.year} · Session {term.session}
                            </SelectItem>
                        ))}
                    </FormSelect>
                </>
            )}
        />
    );
}

function OfferingActions({
    offering,
    institutionId,
    subjects,
    terms,
}: {
    offering: OfferingListItem;
    institutionId: string;
    subjects: SubjectOption[];
    terms: TermOption[];
}) {
    const inUse = offering.counts.assessments + offering.counts.assignments;

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
                                href={`/admin/institutions/${institutionId}/offerings/${offering.id}`}
                            />
                        }
                    >
                        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                        Manage assessments
                    </DropdownMenuItem>
                    {inUse === 0 ? (
                        <OfferingDialog
                            offering={offering}
                            subjects={subjects}
                            terms={terms}
                            trigger={
                                <DropdownMenuItem closeOnClick={false}>
                                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                                    Edit
                                </DropdownMenuItem>
                            }
                        />
                    ) : (
                        <DropdownMenuItem disabled>
                            <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                            Edit locked by history
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DeleteResourceDialog
                        endpoint={`${ENDPOINT}/${offering.id}`}
                        title={`Delete ${offering.subject.subjectCode} offering?`}
                        description={
                            inUse > 0
                                ? 'This offering has assessments or role assignments. Student work and assignment history may prevent deletion.'
                                : 'This offering is empty. This cannot be undone.'
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
