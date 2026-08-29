'use client';

import { useMemo, type ReactElement } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, Edit02Icon, MoreVerticalIcon } from '@hugeicons/core-free-icons';

import { DeleteResourceDialog } from '@/components/admin/delete-resource-dialog';
import {
    InstitutionFilter,
    type InstitutionOption,
} from '@/components/admin/institution-filter';
import { ResourceFormDialog } from '@/components/admin/resource-form-dialog';
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
    EMPTY_SUBJECT_FORM,
    SubjectSchema,
    type SubjectFormValue,
    type SubjectSchemaValue,
} from '@/lib/admin/subject-schema';

export type SubjectListItem = {
    id: string;
    subjectCode: string;
    subjectName: string;
    subjectDescription: string | null;
    institution: { id: string; name: string };
    counts: { offerings: number };
};

const column = columnHelperFor<SubjectListItem>();
const ENDPOINT = '/api/admin/subjects';

export function SubjectsTable({
    subjects,
    institutions,
    institutionId,
    page,
    pageCount,
    total,
    sort,
    dir,
}: {
    subjects: SubjectListItem[];
    institutions: InstitutionOption[];
    institutionId: string | null;
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
                column.accessor('subjectCode', {
                    header: 'Code',
                    cell: (info) => <span className="font-mono text-sm">{info.getValue()}</span>,
                }),

                column.accessor('subjectName', {
                    header: 'Name',
                    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
                }),

                column.accessor((row) => row.institution.name, {
                    id: 'institution',
                    header: 'Institution',
                    cell: (info) => (
                        <span className="text-muted-foreground text-sm">{info.getValue()}</span>
                    ),
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
                        <RowActions subject={info.row.original} institutions={institutions} />
                    ),
                }),
            ] as Array<AdminColumnDef<SubjectListItem>>,
        [institutions],
    );

    return (
        <DataTable
            columns={columns}
            data={subjects}
            emptyMessage={
                list.input
                    ? `No subjects match "${list.input}".`
                    : institutionId
                      ? 'This institution has no subjects yet.'
                      : page > 1
                        ? `Page ${page} is past the end. There ${total === 1 ? 'is' : 'are'} only ${total}.`
                        : 'No subjects yet. Create the first one.'
            }
            toolbar={
                <>
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search subjects…"
                        className="max-w-56"
                        aria-label="Search subjects"
                    />
                    <InstitutionFilter institutions={institutions} value={institutionId} />
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {total} total
                    </span>
                    <div className="flex-1" />
                    <SubjectDialog
                        institutions={institutions}
                        // Đang lọc theo một trường thì điền sẵn trường đó — người dùng gần như
                        // chắc chắn muốn tạo môn cho đúng trường họ đang xem.
                        presetInstitutionId={institutionId}
                        trigger={
                            <Button>
                                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                                New subject
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

function SubjectDialog({
    subject,
    institutions,
    presetInstitutionId,
    trigger,
}: {
    subject?: SubjectListItem;
    institutions: InstitutionOption[];
    presetInstitutionId?: string | null;
    trigger: ReactElement;
}) {
    return (
        <ResourceFormDialog<SubjectFormValue, SubjectSchemaValue>
            schema={SubjectSchema}
            emptyValues={{
                ...EMPTY_SUBJECT_FORM,
                institutionId: presetInstitutionId ?? '',
            }}
            editing={
                subject && {
                    id: subject.id,
                    values: {
                        institutionId: subject.institution.id,
                        subjectCode: subject.subjectCode,
                        subjectName: subject.subjectName,
                        subjectDescription: subject.subjectDescription ?? '',
                    },
                }
            }
            createEndpoint={ENDPOINT}
            title={{ create: 'New subject', edit: 'Edit subject' }}
            description={{
                create: 'A unit an institution teaches.',
                edit: 'Changes apply everywhere this subject appears.',
            }}
            trigger={trigger}
            fields={(form) => (
                <>
                    <FormSelect
                        control={form.control}
                        name="institutionId"
                        label="Institution"
                        description="Subject codes are unique within one institution."
                    >
                        {institutions.map((institution) => (
                            <SelectItem key={institution.id} value={institution.id}>
                                {institution.name}
                            </SelectItem>
                        ))}
                    </FormSelect>

                    <FormInput
                        control={form.control}
                        name="subjectCode"
                        label="Code"
                        placeholder="COMP3000"
                        autoComplete="off"
                        className="font-mono"
                    />
                    <FormInput
                        control={form.control}
                        name="subjectName"
                        label="Name"
                        placeholder="Programming Languages"
                        autoComplete="off"
                    />
                    <FormInput
                        control={form.control}
                        name="subjectDescription"
                        label="Description"
                        description="Optional."
                        autoComplete="off"
                    />
                </>
            )}
        />
    );
}

function RowActions({
    subject,
    institutions,
}: {
    subject: SubjectListItem;
    institutions: InstitutionOption[];
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
                    <SubjectDialog
                        subject={subject}
                        institutions={institutions}
                        trigger={
                            <DropdownMenuItem closeOnClick={false}>
                                <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                                Edit
                            </DropdownMenuItem>
                        }
                    />

                    <DropdownMenuSeparator />

                    <DeleteResourceDialog
                        endpoint={`${ENDPOINT}/${subject.id}`}
                        title={`Delete ${subject.subjectCode}?`}
                        description={
                            subject.counts.offerings > 0
                                ? `This also deletes ${subject.counts.offerings} offering${subject.counts.offerings === 1 ? '' : 's'} and everything inside them. If any student work exists, the database will refuse.`
                                : 'This subject has no offerings. This cannot be undone.'
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
