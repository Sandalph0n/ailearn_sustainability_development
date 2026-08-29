'use client';

import { useMemo, type ReactElement } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, Edit02Icon, MoreVerticalIcon } from '@hugeicons/core-free-icons';

import { DeleteResourceDialog } from '@/components/admin/delete-resource-dialog';
import {
    InstitutionFilter,
    institutionItems,
    type InstitutionOption,
} from '@/components/admin/institution-filter';
import { ResourceFormDialog } from '@/components/admin/resource-form-dialog';
import { useListQuery } from '@/components/admin/use-list-query';
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
import { Input } from '@/components/ui/input';
import { SelectItem } from '@/components/ui/select';
import {
    EMPTY_ROLE_FORM,
    RoleSchema,
    type RoleFormValue,
    type RoleSchemaValue,
} from '@/lib/admin/role-schema';

export type RoleListItem = {
    id: string;
    roleName: string;
    scopeType: 'INSTITUTION' | 'OFFERING';
    emailRegex: string | null;
    includedBy: { id: string; roleName: string } | null;
    institution: { id: string; name: string };
    counts: { assignments: number; requests: number };
};

const column = columnHelperFor<RoleListItem>();
const ENDPOINT = '/api/admin/roles';

export function RolesTable({
    roles,
    institutions,
    institutionId,
    locked,
    /** Vai trò có thể chọn làm "bao gồm bởi" — cùng cơ sở với vai trò đang sửa. */
    rolesByInstitution,
    page,
    pageCount,
    total,
    sort,
    dir,
}: {
    roles: RoleListItem[];
    institutions: InstitutionOption[];
    institutionId: string | null;
    /** Đang ở trang con của một cơ sở: cột và bộ lọc cơ sở đều thừa. */
    locked: boolean;
    rolesByInstitution: Record<string, Array<{ id: string; roleName: string }>>;
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
                column.accessor('roleName', {
                    header: 'Role',
                    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
                }),

                column.accessor('scopeType', {
                    header: 'Scope',
                    cell: (info) => (
                        <Badge
                            variant={info.getValue() === 'INSTITUTION' ? 'default' : 'secondary'}
                        >
                            {info.getValue() === 'INSTITUTION' ? 'Institution' : 'Offering'}
                        </Badge>
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

                column.accessor('emailRegex', {
                    header: 'Email rule',
                    enableSorting: false,
                    cell: (info) =>
                        info.getValue() ? (
                            <code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono text-xs">
                                {info.getValue()}
                            </code>
                        ) : (
                            <span className="text-muted-foreground">—</span>
                        ),
                }),

                column.accessor((row) => row.includedBy?.roleName ?? '', {
                    id: 'includedBy',
                    header: 'Included by',
                    enableSorting: false,
                    cell: (info) => (
                        <span className="text-muted-foreground text-sm">
                            {info.getValue() || '—'}
                        </span>
                    ),
                }),

                column.accessor((row) => row.counts.assignments, {
                    id: 'assignments',
                    header: 'Holders',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),

                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) => (
                        <RowActions
                            role={info.row.original}
                            institutions={institutions}
                            rolesByInstitution={rolesByInstitution}
                            locked={locked}
                        />
                    ),
                }),
            ] as Array<AdminColumnDef<RoleListItem>>,
        [institutions, rolesByInstitution, locked],
    );

    return (
        <DataTable
            columns={columns}
            data={roles}
            emptyMessage={
                list.input
                    ? `No roles match "${list.input}".`
                    : institutionId
                      ? 'This institution has no roles yet.'
                      : page > 1
                        ? `Page ${page} is past the end. There ${total === 1 ? 'is' : 'are'} only ${total}.`
                        : 'No roles yet. Create the first one.'
            }
            toolbar={
                <>
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search roles…"
                        className="max-w-56"
                        aria-label="Search roles"
                    />
                    {!locked && (
                        <InstitutionFilter institutions={institutions} value={institutionId} />
                    )}
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {total} total
                    </span>
                    <div className="flex-1" />
                    <RoleDialog
                        institutions={institutions}
                        rolesByInstitution={rolesByInstitution}
                        presetInstitutionId={institutionId}
                        locked={locked}
                        trigger={
                            <Button>
                                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                                New role
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

function RoleDialog({
    role,
    institutions,
    rolesByInstitution,
    presetInstitutionId,
    locked = false,
    trigger,
}: {
    role?: RoleListItem;
    institutions: InstitutionOption[];
    rolesByInstitution: Record<string, Array<{ id: string; roleName: string }>>;
    presetInstitutionId?: string | null;
    locked?: boolean;
    trigger: ReactElement;
}) {
    return (
        <ResourceFormDialog<RoleFormValue, RoleSchemaValue>
            schema={RoleSchema}
            emptyValues={
                { ...EMPTY_ROLE_FORM, institutionId: presetInstitutionId ?? '' } as RoleFormValue
            }
            editing={
                role && {
                    id: role.id,
                    values: {
                        institutionId: role.institution.id,
                        roleName: role.roleName,
                        scopeType: role.scopeType,
                        emailRegex: role.emailRegex ?? '',
                        includedById: role.includedBy?.id ?? '',
                    } as unknown as RoleFormValue,
                }
            }
            createEndpoint={ENDPOINT}
            title={{ create: 'New role', edit: 'Edit role' }}
            description={{
                create: 'A role someone can hold at an institution.',
                edit: 'Changes apply to everyone who holds this role.',
            }}
            trigger={trigger}
            fields={(form) => {
                // Vai trò cha phải cùng cơ sở — bao gồm một vai trò của trường khác là vô nghĩa.
                const chosenInstitution = form.watch('institutionId');
                const candidates = (rolesByInstitution[chosenInstitution] ?? []).filter(
                    (candidate) => candidate.id !== role?.id,
                );

                return (
                    <>
                        {/* Ở trang con thì cơ sở đã cố định — ô chọn chỉ có một mục, bỏ đi cho gọn. */}
                        {!locked && (
                            <FormSelect
                                control={form.control}
                                name="institutionId"
                                label="Institution"
                                items={institutionItems(institutions)}
                            >
                                {institutions.map((institution) => (
                                    <SelectItem key={institution.id} value={institution.id}>
                                        {institution.name}
                                    </SelectItem>
                                ))}
                            </FormSelect>
                        )}

                        <FormInput
                            control={form.control}
                            name="roleName"
                            label="Name"
                            placeholder="Tutor"
                            autoComplete="off"
                        />

                        <FormSelect
                            control={form.control}
                            name="scopeType"
                            label="Scope"
                            description="Institution-wide, or per offering."
                        >
                            <SelectItem value="INSTITUTION">Institution</SelectItem>
                            <SelectItem value="OFFERING">Offering</SelectItem>
                        </FormSelect>

                        <FormInput
                            control={form.control}
                            name="emailRegex"
                            label="Email rule"
                            description="Optional, institution-wide roles only. Grants this role automatically on join."
                            placeholder="@students\.mq\.edu\.au$"
                            autoComplete="off"
                            className="font-mono"
                        />

                        <FormSelect
                            control={form.control}
                            name="includedById"
                            label="Included by"
                            items={Object.fromEntries(
                                candidates.map((candidate) => [candidate.id, candidate.roleName]),
                            )}
                            description={
                                candidates.length > 0
                                    ? 'Optional. A role that also grants this one.'
                                    : 'No other roles at this institution yet.'
                            }
                        >
                            {candidates.map((candidate) => (
                                <SelectItem key={candidate.id} value={candidate.id}>
                                    {candidate.roleName}
                                </SelectItem>
                            ))}
                        </FormSelect>
                    </>
                );
            }}
        />
    );
}

function RowActions({
    role,
    institutions,
    rolesByInstitution,
    locked,
}: {
    role: RoleListItem;
    institutions: InstitutionOption[];
    rolesByInstitution: Record<string, Array<{ id: string; roleName: string }>>;
    locked: boolean;
}) {
    const inUse = role.counts.assignments + role.counts.requests;

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
                    <RoleDialog
                        role={role}
                        institutions={institutions}
                        rolesByInstitution={rolesByInstitution}
                        locked={locked}
                        trigger={
                            <DropdownMenuItem closeOnClick={false}>
                                <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                                Edit
                            </DropdownMenuItem>
                        }
                    />

                    <DropdownMenuSeparator />

                    <DeleteResourceDialog
                        endpoint={`${ENDPOINT}/${role.id}`}
                        title={`Delete ${role.roleName}?`}
                        description={
                            inUse > 0
                                ? 'Someone holds this role or has requested it, so the database will refuse to delete it.'
                                : 'Nobody holds this role. This cannot be undone.'
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
