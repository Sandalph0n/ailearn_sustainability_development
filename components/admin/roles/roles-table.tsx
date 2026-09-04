'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    ArrowRight01Icon,
    Delete02Icon,
    Edit02Icon,
    MoreVerticalIcon,
} from '@hugeicons/core-free-icons';

import { DeleteResourceDialog } from '@/components/admin/delete-resource-dialog';
import { FormCheckboxList } from '@/components/admin/form-checkbox-list';
import { FormTransferList } from '@/components/admin/form-transfer-list';
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
    autoGrantEmailRegex: string | null;
    includedRoles: Array<{ id: string; roleName: string }>;
    permissions: Array<{ id: string; permission: string; description: string | null }>;
    institution: { id: string; name: string };
    counts: { assignments: number; requests: number };
};

export type RoleInheritanceOption = {
    id: string;
    roleName: string;
    /** Direct plus transitive permissions this role contributes when included. */
    effectivePermissionIds: string[];
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
    permissions,
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
    rolesByInstitution: Record<string, RoleInheritanceOption[]>;
    permissions: Array<{ id: string; permission: string; description: string | null }>;
    page: number;
    pageCount: number;
    total: number;
    sort: string;
    dir: 'asc' | 'desc';
}) {
    const list = useListQuery();
    const [editing, setEditing] = useState<RoleListItem | 'create' | null>(null);

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

                column.accessor('autoGrantEmailRegex', {
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

                column.accessor((row) => row.includedRoles.map((role) => role.roleName).join(', '), {
                    id: 'includedRoles',
                    header: 'Includes',
                    enableSorting: false,
                    cell: (info) => (
                        <span className="text-muted-foreground text-sm">
                            {info.getValue() || '—'}
                        </span>
                    ),
                }),

                column.accessor((row) => row.counts.assignments, {
                    id: 'assignments',
                    header: 'Active assignments',
                    enableSorting: false,
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),

                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) => (
                        <RowActions
                            role={info.row.original}
                            locked={locked}
                            onEdit={() => setEditing(info.row.original)}
                        />
                    ),
                }),
            ] as Array<AdminColumnDef<RoleListItem>>,
        [locked],
    );

    if (editing) {
        return (
            <RoleForm
                role={editing === 'create' ? undefined : editing}
                institutions={institutions}
                rolesByInstitution={rolesByInstitution}
                permissions={permissions}
                presetInstitutionId={institutionId}
                locked={locked}
                onCancel={() => setEditing(null)}
            />
        );
    }

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
                    {locked && (
                        <Button onClick={() => setEditing('create')}>
                            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                            New role
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

function RoleForm({
    role,
    institutions,
    rolesByInstitution,
    permissions,
    presetInstitutionId,
    locked = false,
    onCancel,
}: {
    role?: RoleListItem;
    institutions: InstitutionOption[];
    rolesByInstitution: Record<string, RoleInheritanceOption[]>;
    permissions: Array<{ id: string; permission: string; description: string | null }>;
    presetInstitutionId?: string | null;
    locked?: boolean;
    onCancel: () => void;
}) {
    return (
        <ResourceFormPage<RoleFormValue, RoleSchemaValue>
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
                        autoGrantEmailRegex: role.autoGrantEmailRegex ?? '',
                        includedRoleIds: role.includedRoles.map((included) => included.id),
                        permissionIds: role.permissions.map((permission) => permission.id),
                    } as unknown as RoleFormValue,
                }
            }
            createEndpoint={ENDPOINT}
            title={{ create: 'New role', edit: 'Edit role' }}
            description={{
                create: 'A role someone can hold at an institution.',
                edit: 'Changes apply to everyone who holds this role.',
            }}
            onCancel={onCancel}
        >
            {(form) => {
                // Chỉ chào các vai trò cùng cơ sở; backend và trigger vẫn kiểm lại độc lập.
                const chosenInstitution = form.watch('institutionId');
                const candidates = (rolesByInstitution[chosenInstitution] ?? []).filter(
                    (candidate) => candidate.id !== role?.id,
                );
                const includedRoleIds = new Set(form.watch('includedRoleIds'));
                const inheritedByPermission = new Map<string, string[]>();

                for (const candidate of candidates) {
                    if (!includedRoleIds.has(candidate.id)) continue;

                    for (const permissionId of candidate.effectivePermissionIds) {
                        const sources = inheritedByPermission.get(permissionId) ?? [];
                        sources.push(candidate.roleName);
                        inheritedByPermission.set(permissionId, sources);
                    }
                }

                return (
                    <div className="flex flex-col">
                        <ResourceFormSection
                            title="Role identity"
                            description="Set where this role applies and whether an institution email rule can grant it automatically."
                        >
                            <div className="grid gap-5 md:grid-cols-2">
                                {!locked && (
                                    <div className="md:col-span-2">
                                        <FormSelect
                                            control={form.control}
                                            name="institutionId"
                                            label="Institution"
                                            items={institutionItems(institutions)}
                                        >
                                            {institutions.map((institution) => (
                                                <SelectItem
                                                    key={institution.id}
                                                    value={institution.id}
                                                >
                                                    {institution.name}
                                                </SelectItem>
                                            ))}
                                        </FormSelect>
                                    </div>
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
                                <div className="md:col-span-2">
                                    <FormInput
                                        control={form.control}
                                        name="autoGrantEmailRegex"
                                        label="Email rule"
                                        description="Optional, institution-wide roles only. Grants this role automatically on join."
                                        placeholder="@students\.mq\.edu\.au$"
                                        autoComplete="off"
                                        className="font-mono"
                                    />
                                </div>
                            </div>
                        </ResourceFormSection>

                        <ResourceFormSection
                            title="Access model"
                            description="Compose this role from other roles, then add permissions that belong directly to it."
                        >
                            <div className="flex flex-col gap-7">
                                <div className="max-w-2xl">
                                    <FormCheckboxList
                                        control={form.control}
                                        name="includedRoleIds"
                                        label="Includes roles"
                                        description="Inherit every active permission from these roles."
                                        emptyMessage="No other roles at this institution yet."
                                        className="max-h-56"
                                        options={candidates.map((candidate) => ({
                                            value: candidate.id,
                                            label: candidate.roleName,
                                        }))}
                                    />
                                </div>
                                <FormTransferList
                                    control={form.control}
                                    name="permissionIds"
                                    label="Permissions"
                                    description="Direct grants can be moved. Permissions supplied by included roles remain selected and locked."
                                    searchPlaceholder="Search permissions…"
                                    availableEmptyMessage="No permissions are available."
                                    selectedEmptyMessage="No permissions selected."
                                    lockedSelectedOptions={Array.from(
                                        inheritedByPermission.entries(),
                                        ([value, sourceRoles]) => ({
                                            value,
                                            annotation: `Inherited via ${sourceRoles.join(', ')}`,
                                            disabledReason: `This permission is inherited via ${sourceRoles.join(', ')}. It cannot be removed here. Remove that role from Includes roles, or remove the permission from its source role.`,
                                        }),
                                    )}
                                    options={permissions.map((permission) => ({
                                        value: permission.id,
                                        label: permission.permission,
                                        description: permission.description ?? undefined,
                                    }))}
                                />
                            </div>
                        </ResourceFormSection>
                    </div>
                );
            }}
        </ResourceFormPage>
    );
}

function RowActions({
    role,
    locked,
    onEdit,
}: {
    role: RoleListItem;
    locked: boolean;
    onEdit: () => void;
}) {
    const inUse = role.counts.assignments + role.counts.requests;

    if (!locked) {
        return (
            <div className="flex justify-end">
                <Button
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/admin/institutions/${role.institution.id}/roles`} />}
                >
                    Manage
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                </Button>
            </div>
        );
    }

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
