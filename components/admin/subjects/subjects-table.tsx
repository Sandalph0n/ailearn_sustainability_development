'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    Delete02Icon,
    Download04Icon,
    Edit02Icon,
    MoreVerticalIcon,
} from '@hugeicons/core-free-icons';
import type { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';

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
    EMPTY_SUBJECT_FORM,
    SubjectSchema,
    type SubjectFormValue,
    type SubjectSchemaValue,
} from '@/lib/admin/subject-schema';
import type { CatalogInfo, CatalogSubject } from '@/lib/institution-adapters';

/** Cơ sở kèm nguồn danh mục công khai (nếu có) để biểu mẫu hiện nút tra cứu. */
export type SubjectInstitutionOption = InstitutionOption & { catalog: CatalogInfo | null };

export type SubjectListItem = {
    id: string;
    subjectCode: string;
    subjectName: string;
    subjectDescription: string | null;
    institution: { id: string; name: string };
    counts: { offerings: number };
};

export type SubjectCapabilities = {
    create: boolean;
    view: boolean;
    update: boolean;
    delete: boolean;
};

const column = columnHelperFor<SubjectListItem>();
const FULL_CAPABILITIES: SubjectCapabilities = {
    create: true,
    view: true,
    update: true,
    delete: true,
};

export function SubjectsTable({
    subjects,
    institutions,
    institutionId,
    locked,
    page,
    pageCount,
    total,
    sort,
    dir,
    endpoint = '/api/admin/subjects',
    contextQuery = '',
    subjectBasePath,
    capabilities = FULL_CAPABILITIES,
}: {
    subjects: SubjectListItem[];
    institutions: SubjectInstitutionOption[];
    institutionId: string | null;
    /** Đang ở trang con của một cơ sở: cột và bộ lọc cơ sở đều thừa. */
    locked: boolean;
    page: number;
    pageCount: number;
    total: number;
    sort: string;
    dir: 'asc' | 'desc';
    endpoint?: string;
    /** Active institution/role context, forwarded to protected non-admin endpoints. */
    contextQuery?: string;
    /** When present, subject names and offering counts lead to a contextual detail page. */
    subjectBasePath?: string;
    capabilities?: SubjectCapabilities;
}) {
    const list = useListQuery();
    const [editing, setEditing] = useState<SubjectListItem | 'create' | null>(null);

    const columns = useMemo(
        () =>
            [
                column.accessor('subjectCode', {
                    header: 'Code',
                    cell: (info) => <span className="font-mono text-sm">{info.getValue()}</span>,
                }),

                column.accessor('subjectName', {
                    header: 'Name',
                    cell: (info) => {
                        const href = subjectBasePath
                            ? contextualHref(`${subjectBasePath}/${info.row.original.id}`, contextQuery)
                            : null;
                        return href ? (
                            <Link href={href} className="font-medium hover:text-primary hover:underline underline-offset-4">
                                {info.getValue()}
                            </Link>
                        ) : <span className="font-medium">{info.getValue()}</span>;
                    },
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

                column.accessor((row) => row.counts.offerings, {
                    id: 'offerings',
                    header: 'Offerings',
                    cell: (info) => {
                        const href = subjectBasePath
                            ? contextualHref(`${subjectBasePath}/${info.row.original.id}`, contextQuery)
                            : null;
                        return href ? (
                            <Link
                                href={href}
                                className="text-primary inline-flex min-w-8 items-center gap-1 font-medium tabular-nums hover:underline underline-offset-4"
                                aria-label={`View ${info.getValue()} offerings for ${info.row.original.subjectCode}`}
                            >
                                {info.getValue()}
                            </Link>
                        ) : <span className="tabular-nums">{info.getValue()}</span>;
                    },
                }),

                ...(capabilities.update || capabilities.delete
                    ? [
                          column.display({
                              id: 'actions',
                              header: '',
                              cell: (info) => (
                                  <RowActions
                                      subject={info.row.original}
                                      canUpdate={capabilities.update}
                                      canDelete={capabilities.delete}
                                      endpoint={endpointFor(
                                          `${endpoint}/${info.row.original.id}`,
                                          contextQuery,
                                      )}
                                      onEdit={() => setEditing(info.row.original)}
                                  />
                              ),
                          }),
                      ]
                    : []),
            ] as Array<AdminColumnDef<SubjectListItem>>,
        [capabilities.delete, capabilities.update, contextQuery, endpoint, locked, subjectBasePath],
    );

    if (editing) {
        return (
            <SubjectForm
                subject={editing === 'create' ? undefined : editing}
                institutions={institutions}
                presetInstitutionId={institutionId}
                locked={locked}
                createEndpoint={endpointFor(endpoint, contextQuery)}
                lookupEndpoint={endpointFor(`${endpoint}/lookup`, contextQuery)}
                editEndpoint={
                    editing === 'create'
                        ? undefined
                        : endpointFor(`${endpoint}/${editing.id}`, contextQuery)
                }
                onCancel={() => setEditing(null)}
            />
        );
    }

    return (
        <DataTable
            columns={columns}
            data={subjects}
            emptyMessage={
                !capabilities.view
                    ? 'This role cannot view existing subjects.'
                    : list.input
                    ? `No subjects match "${list.input}".`
                    : institutionId
                      ? 'This institution has no subjects yet.'
                      : page > 1
                        ? `Page ${page} is past the end. There ${total === 1 ? 'is' : 'are'} only ${total}.`
                        : 'No subjects yet. Create the first one.'
            }
            toolbar={
                <>
                    {capabilities.view && (
                        <Input
                            value={list.input}
                            onChange={(event) => list.setInput(event.target.value)}
                            placeholder="Search subjects…"
                            className="max-w-56"
                            aria-label="Search subjects"
                        />
                    )}
                    {capabilities.view && !locked && (
                        <InstitutionFilter
                            institutions={institutions}
                            value={institutionId}
                            onChange={(next) =>
                                list.setParams({ institution: next, page: null })
                            }
                        />
                    )}
                    {capabilities.view && (
                        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                            {total} total
                        </span>
                    )}
                    <div className="flex-1" />
                    {capabilities.create && (
                        <Button onClick={() => setEditing('create')}>
                            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                            New subject
                        </Button>
                    )}
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

function SubjectForm({
    subject,
    institutions,
    presetInstitutionId,
    locked = false,
    createEndpoint,
    lookupEndpoint,
    editEndpoint,
    onCancel,
}: {
    subject?: SubjectListItem;
    institutions: SubjectInstitutionOption[];
    presetInstitutionId?: string | null;
    locked?: boolean;
    createEndpoint: string;
    /** `GET ?code=` tra mã môn trong danh mục công khai của cơ sở đang chọn. */
    lookupEndpoint: string;
    editEndpoint?: string;
    onCancel: () => void;
}) {
    return (
        <ResourceFormPage<SubjectFormValue, SubjectSchemaValue>
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
            createEndpoint={createEndpoint}
            editEndpoint={editEndpoint}
            title={{ create: 'New subject', edit: 'Edit subject' }}
            description={{
                create: 'A unit an institution teaches.',
                edit: 'Changes apply everywhere this subject appears.',
            }}
            onCancel={onCancel}
        >
            {(form) => (
                <ResourceFormSection
                    title="Subject details"
                    description="The code identifies the unit inside its institution; the name and description explain it elsewhere in the platform."
                >
                    <div className="grid gap-5 md:grid-cols-2">
                        {!locked && (
                            <div className="md:col-span-2">
                                <FormSelect
                                    control={form.control}
                                    name="institutionId"
                                    label="Institution"
                                    items={institutionItems(institutions)}
                                    description="Subject codes are unique within one institution."
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
                        <div className="md:col-span-2">
                            <FormInput
                                control={form.control}
                                name="subjectDescription"
                                label="Description"
                                description="Optional."
                                autoComplete="off"
                            />
                        </div>
                        <CatalogLookup
                            form={form}
                            institutions={institutions}
                            lookupEndpoint={lookupEndpoint}
                        />
                    </div>
                </ResourceFormSection>
            )}
        </ResourceFormPage>
    );
}

/**
 * Nút "điền từ danh mục công khai".
 *
 * Chỉ hiện khi cơ sở đang chọn có adapter. Kết quả đổ vào form chứ không lưu thẳng: người dùng
 * vẫn thấy và sửa được trước khi bấm Save, vì mô tả Handbook thường dài hơn mức muốn giữ.
 */
function CatalogLookup({
    form,
    institutions,
    lookupEndpoint,
}: {
    form: UseFormReturn<SubjectFormValue, unknown, SubjectSchemaValue>;
    institutions: SubjectInstitutionOption[];
    lookupEndpoint: string;
}) {
    const [pending, setPending] = useState(false);
    const institutionId = form.watch('institutionId');
    const code = form.watch('subjectCode').trim();
    const catalog = institutions.find((institution) => institution.id === institutionId)?.catalog;

    if (!catalog) return null;

    async function lookup() {
        setPending(true);
        try {
            // Route admin cần `institutionId`; route theo cơ sở đã có id trong đường dẫn và bỏ qua.
            const url = new URL(lookupEndpoint, window.location.origin);
            url.searchParams.set('institutionId', institutionId);
            url.searchParams.set('code', code);

            const response = await fetch(url, { headers: { accept: 'application/json' } });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error(body?.error?.message ?? `Could not reach the ${catalog!.label}.`);
                return;
            }

            const subject = body.subject as CatalogSubject;
            const fill = { shouldDirty: true, shouldValidate: true };
            form.setValue('subjectCode', subject.subjectCode, fill);
            form.setValue('subjectName', subject.subjectName, fill);
            form.setValue('subjectDescription', subject.subjectDescription ?? '', fill);
            toast.success(`Filled from the ${catalog!.label} (${subject.year}). Review before saving.`);
        } catch {
            toast.error('Cannot reach the server. Check your connection.');
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || code.length < 2 || form.formState.isSubmitting}
                onClick={lookup}
            >
                <HugeiconsIcon icon={Download04Icon} strokeWidth={2} />
                {pending ? 'Looking up…' : `Fill from ${catalog.label}`}
            </Button>
            <p className="text-muted-foreground text-sm">
                Looks the code up in the public {catalog.label} and fills in the name and
                description. You can still edit them before saving.
            </p>
        </div>
    );
}

function RowActions({ subject, canUpdate, canDelete, endpoint, onEdit }: {
    subject: SubjectListItem;
    canUpdate: boolean;
    canDelete: boolean;
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
                    {canUpdate && (
                        <DropdownMenuItem onClick={onEdit}>
                            <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                            Edit
                        </DropdownMenuItem>
                    )}

                    {canUpdate && canDelete && <DropdownMenuSeparator />}

                    {canDelete && (
                        <DeleteResourceDialog
                            endpoint={endpoint}
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
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function endpointFor(path: string, query: string): string {
    return query ? `${path}?${query}` : path;
}

function contextualHref(path: string, query: string): string {
    return query ? `${path}?${query}` : path;
}
