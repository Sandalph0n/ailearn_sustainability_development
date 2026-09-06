'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { UseFormReturn } from 'react-hook-form';
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
import {
    FULL_CRUD_CAPABILITIES,
    type CrudCapabilities,
} from '@/lib/admin/resource-capabilities';

export type RoleListItem = {
    id: string;
    roleCode: string;
    roleName: string;
    scopeType: 'INSTITUTION' | 'OFFERING';
    requestMode: 'DISABLED' | 'PUBLIC' | 'CONDITIONAL';
    autoGrantEmailRegex: string | null;
    prerequisiteRoles: Array<{ id: string; roleName: string }>;
    includedRoles: Array<{ id: string; roleName: string }>;
    permissions: Array<{ id: string; permission: string; description: string | null }>;
    institution: { id: string; name: string };
    counts: { assignments: number; requests: number };
};

export type RoleInheritanceOption = {
    id: string;
    roleCode: string;
    roleName: string;
    scopeType: 'INSTITUTION' | 'OFFERING';
    /** Direct plus transitive permissions this role contributes when included. */
    effectivePermissionIds: string[];
};

const column = columnHelperFor<RoleListItem>();
const ENDPOINT = '/api/admin/roles';
const CHIEF_MANAGEMENT_ROLE_CODE = 'institution:chief.management';

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
    endpoint = ENDPOINT,
    contextQuery = '',
    capabilities = FULL_CRUD_CAPABILITIES,
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
    endpoint?: string;
    contextQuery?: string;
    capabilities?: CrudCapabilities;
}) {
    const list = useListQuery();
    const [editing, setEditing] = useState<RoleListItem | 'create' | null>(null);

    const columns = useMemo(
        () =>
            [
                column.accessor('roleName', {
                    header: 'Role',
                    cell: (info) => (
                        <span className="grid gap-0.5">
                            <span className="font-medium">{info.getValue()}</span>
                            <code className="text-muted-foreground font-mono text-[0.7rem]">
                                {info.row.original.roleCode}
                            </code>
                        </span>
                    ),
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

                column.accessor('requestMode', {
                    header: 'Requests',
                    enableSorting: false,
                    cell: (info) => {
                        const role = info.row.original;
                        if (info.getValue() === 'DISABLED') {
                            return <span className="text-muted-foreground text-sm">Disabled</span>;
                        }
                        if (info.getValue() === 'PUBLIC') return <Badge variant="outline">Public</Badge>;
                        return (
                            <span className="text-muted-foreground text-sm">
                                Conditional · {role.prerequisiteRoles.length} prerequisite
                                {role.prerequisiteRoles.length === 1 ? '' : 's'}
                            </span>
                        );
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
                            endpoint={endpoint}
                            contextQuery={contextQuery}
                            capabilities={capabilities}
                            onEdit={() => setEditing(info.row.original)}
                        />
                    ),
                }),
            ] as Array<AdminColumnDef<RoleListItem>>,
        [capabilities, contextQuery, endpoint, locked],
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
                endpoint={endpoint}
                contextQuery={contextQuery}
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
                    {locked && capabilities.create && (
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
    endpoint,
    contextQuery,
    onCancel,
}: {
    role?: RoleListItem;
    institutions: InstitutionOption[];
    rolesByInstitution: Record<string, RoleInheritanceOption[]>;
    permissions: Array<{ id: string; permission: string; description: string | null }>;
    presetInstitutionId?: string | null;
    locked?: boolean;
    endpoint: string;
    contextQuery: string;
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
                        roleCode: role.roleCode,
                        roleName: role.roleName,
                        scopeType: role.scopeType,
                        requestMode: role.requestMode,
                        autoGrantEmailRegex: role.autoGrantEmailRegex ?? '',
                        includedRoleIds: role.includedRoles.map((included) => included.id),
                        permissionIds: role.permissions.map((permission) => permission.id),
                        prerequisiteRoleIds: role.prerequisiteRoles.map(
                            (prerequisite) => prerequisite.id,
                        ),
                    } as unknown as RoleFormValue,
                }
            }
            createEndpoint={endpointFor(endpoint, contextQuery)}
            editEndpoint={role ? endpointFor(`${endpoint}/${role.id}`, contextQuery) : undefined}
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
                const chosenScope = form.watch('scopeType');
                const requestMode = form.watch('requestMode');
                const candidates = (rolesByInstitution[chosenInstitution] ?? []).filter(
                    (candidate) =>
                        candidate.id !== role?.id && candidate.scopeType === chosenScope,
                );
                const includedRoleIds = new Set(form.watch('includedRoleIds'));
                const inheritedByPermission = new Map<string, string[]>();
                const prerequisiteCandidates = (rolesByInstitution[chosenInstitution] ?? []).filter(
                    (candidate) => candidate.id !== role?.id,
                );

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
                                    label="Display name"
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
                                        name="roleCode"
                                        label="Role code"
                                        description="Stable identifier. Its prefix must match the selected scope."
                                        placeholder="offering:tutor"
                                        autoComplete="off"
                                        className="font-mono"
                                    />
                                </div>
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
                            title="Request policy"
                            description="Control whether people may request this role themselves. Conditional prerequisites are evaluated as an OR list."
                        >
                            <RoleRequestPolicyFields
                                form={form}
                                requestMode={requestMode}
                                candidates={prerequisiteCandidates}
                            />
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

function RoleRequestPolicyFields({
    form,
    requestMode,
    candidates,
}: {
    form: UseFormReturn<RoleFormValue, unknown, RoleSchemaValue>;
    requestMode: RoleFormValue['requestMode'];
    candidates: RoleInheritanceOption[];
}) {
    useEffect(() => {
        if (requestMode !== 'CONDITIONAL') {
            form.setValue('prerequisiteRoleIds', []);
        }
    }, [form, requestMode]);

    return (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(22rem,1.3fr)]">
            <FormSelect
                control={form.control}
                name="requestMode"
                label="Who can request this role"
                description="Disabled roles can still be granted directly by an authorised manager."
                items={{
                    DISABLED: 'Disabled',
                    PUBLIC: 'Anyone signed in',
                    CONDITIONAL: 'People with prerequisite roles',
                }}
            >
                <SelectItem value="DISABLED">Disabled</SelectItem>
                <SelectItem value="PUBLIC">Anyone signed in</SelectItem>
                <SelectItem value="CONDITIONAL">People with prerequisite roles</SelectItem>
            </FormSelect>

            {requestMode === 'CONDITIONAL' ? (
                <FormCheckboxList
                    control={form.control}
                    name="prerequisiteRoleIds"
                    label="Prerequisite roles"
                    description="Holding any one of these roles makes this role visible and requestable."
                    emptyMessage="Create another role before configuring a prerequisite."
                    className="max-h-60"
                    options={candidates.map((candidate) => ({
                        value: candidate.id,
                        label: candidate.roleName,
                        description:
                            candidate.scopeType === 'INSTITUTION'
                                ? 'Institution role'
                                : 'Offering role',
                    }))}
                />
            ) : (
                <div className="border-border bg-muted/25 rounded-lg border px-4 py-3 text-sm">
                    <p className="font-medium">
                        {requestMode === 'PUBLIC'
                            ? 'No prerequisite is required.'
                            : 'This role will not appear in self-service requests.'}
                    </p>
                    <p className="text-muted-foreground mt-1 leading-5">
                        {requestMode === 'PUBLIC'
                            ? 'Any signed-in user can find and request it at this institution.'
                            : 'An authorised institution manager must grant it directly.'}
                    </p>
                </div>
            )}
        </div>
    );
}

function RowActions({
    role,
    locked,
    endpoint,
    contextQuery,
    capabilities,
    onEdit,
}: {
    role: RoleListItem;
    locked: boolean;
    endpoint: string;
    contextQuery: string;
    capabilities: CrudCapabilities;
    onEdit: () => void;
}) {
    const inUse = role.counts.assignments + role.counts.requests;
    const protectedInstitutionRole =
        endpoint !== ENDPOINT && role.roleCode === CHIEF_MANAGEMENT_ROLE_CODE;

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

    if (protectedInstitutionRole || (!capabilities.update && !capabilities.delete)) return null;

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
                    {capabilities.update && <DropdownMenuItem onClick={onEdit}>
                        <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                        Edit
                    </DropdownMenuItem>}

                    {capabilities.update && capabilities.delete && <DropdownMenuSeparator />}

                    {capabilities.delete && <DeleteResourceDialog
                        endpoint={endpointFor(`${endpoint}/${role.id}`, contextQuery)}
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
                    />}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function endpointFor(path: string, query: string): string {
    return query ? `${path}?${query}` : path;
}
