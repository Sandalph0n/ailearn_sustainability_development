'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    ArrowRight01Icon,
    Delete02Icon,
    Edit02Icon,
    MoreVerticalIcon,
} from '@hugeicons/core-free-icons';

import { DeleteResourceDialog } from '@/components/admin/delete-resource-dialog';
import {
    ResourceFormPage,
    ResourceFormSection,
} from '@/components/admin/resource-form-page';
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
import {
    FULL_CRUD_CAPABILITIES,
    type CrudCapabilities,
} from '@/lib/admin/resource-capabilities';

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
    endpoint = ENDPOINT,
    assessmentBasePath,
    detailActionLabel = 'Manage assessments',
    contextQuery,
    capabilities = FULL_CRUD_CAPABILITIES,
    emptyMessage,
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
    endpoint?: string;
    assessmentBasePath?: string | null;
    detailActionLabel?: string;
    contextQuery?: string;
    capabilities?: CrudCapabilities;
    emptyMessage?: string;
}) {
    const list = useListQuery();
    const [editing, setEditing] = useState<OfferingListItem | 'create' | null>(null);

    const columns = useMemo(
        () =>
            [
                column.accessor((row) => row.subject.subjectCode, {
                    id: 'subject',
                    header: 'Subject',
                    cell: (info) => {
                        const body = <>
                            <span className="font-mono text-sm font-medium">{info.getValue()}</span>
                            <span className="text-muted-foreground text-xs">
                                {info.row.original.subject.subjectName}
                            </span>
                        </>;
                        const base = assessmentBasePath === undefined
                            ? `/admin/institutions/${institutionId}/offerings`
                            : assessmentBasePath;
                        return base ? (
                            <Link
                                href={`${base}/${info.row.original.id}${contextQuery ? `?${contextQuery}` : ''}`}
                                className="hover:text-primary flex flex-col transition-colors"
                            >
                                {body}
                            </Link>
                        ) : <span className="flex flex-col">{body}</span>;
                    },
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
                            endpoint={endpoint}
                            assessmentBasePath={assessmentBasePath}
                            detailActionLabel={detailActionLabel}
                            contextQuery={contextQuery}
                            capabilities={capabilities}
                            onEdit={() => setEditing(info.row.original)}
                        />
                    ),
                }),
            ] as Array<AdminColumnDef<OfferingListItem>>,
        [assessmentBasePath, capabilities, contextQuery, detailActionLabel, endpoint, institutionId],
    );

    const canCreate = subjects.length > 0 && terms.length > 0;

    if (editing) {
        return (
            <OfferingForm
                offering={editing === 'create' ? undefined : editing}
                subjects={subjects}
                terms={terms}
                endpoint={endpoint}
                contextQuery={contextQuery}
                onCancel={() => setEditing(null)}
            />
        );
    }

    return (
        <DataTable
            columns={columns}
            data={offerings}
            emptyMessage={
                list.input || subjectId || termId
                    ? 'No offerings match these filters.'
                    : (emptyMessage ?? 'No offerings yet. Connect a subject to a study term.')
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
                    {capabilities.create && <Button disabled={!canCreate} onClick={() => setEditing('create')}>
                        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                        New offering
                    </Button>}
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

function OfferingForm({
    offering,
    subjects,
    terms,
    endpoint,
    contextQuery,
    onCancel,
}: {
    offering?: OfferingListItem;
    subjects: SubjectOption[];
    terms: TermOption[];
    endpoint: string;
    contextQuery?: string;
    onCancel: () => void;
}) {
    return (
        <ResourceFormPage<OfferingFormValue, OfferingSchemaValue>
            schema={OfferingSchema}
            emptyValues={EMPTY_OFFERING_FORM}
            editing={
                offering && {
                    id: offering.id,
                    values: { subjectId: offering.subject.id, termId: offering.term.id },
                }
            }
            createEndpoint={endpointFor(endpoint, contextQuery)}
            editEndpoint={
                offering ? endpointFor(`${endpoint}/${offering.id}`, contextQuery) : undefined
            }
            title={{ create: 'New offering', edit: 'Edit offering' }}
            description={{
                create: 'Choose which subject runs in which study term.',
                edit: 'An offering with content or assignment history cannot be moved.',
            }}
            onCancel={onCancel}
        >
            {(form) => (
                <ResourceFormSection
                    title="Offering placement"
                    description="Connect one subject to one study term. Assessments and scoped roles will belong to this exact pairing."
                >
                    <div className="grid gap-5 md:grid-cols-2">
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
                    </div>
                </ResourceFormSection>
            )}
        </ResourceFormPage>
    );
}

function OfferingActions({
    offering,
    institutionId,
    endpoint,
    assessmentBasePath,
    detailActionLabel,
    contextQuery,
    capabilities,
    onEdit,
}: {
    offering: OfferingListItem;
    institutionId: string;
    endpoint: string;
    assessmentBasePath?: string | null;
    detailActionLabel: string;
    contextQuery?: string;
    capabilities: CrudCapabilities;
    onEdit: () => void;
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
                    {(assessmentBasePath !== null) && <DropdownMenuItem
                        render={
                            <Link
                                href={`${assessmentBasePath ?? `/admin/institutions/${institutionId}/offerings`}/${offering.id}${contextQuery ? `?${contextQuery}` : ''}`}
                            />
                        }
                    >
                        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                        {detailActionLabel}
                    </DropdownMenuItem>}
                    {capabilities.update && (inUse === 0 ? (
                        <DropdownMenuItem onClick={onEdit}>
                            <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                            Edit
                        </DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem disabled>
                            <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                            Edit locked by history
                        </DropdownMenuItem>
                    ))}
                    {capabilities.delete && <DropdownMenuSeparator />}
                    {capabilities.delete && <DeleteResourceDialog
                        endpoint={endpointFor(`${endpoint}/${offering.id}`, contextQuery)}
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
                    />}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function endpointFor(path: string, query = ''): string {
    return query ? `${path}?${query}` : path;
}
