'use client';

import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    Cancel01Icon,
    MoreVerticalIcon,
} from '@hugeicons/core-free-icons';
import { useWatch, type UseFormReturn } from 'react-hook-form';

import { ResourceActionDialog } from '@/components/admin/resource-action-dialog';
import { ResourceFormDialog } from '@/components/admin/resource-form-dialog';
import { UrlSelectFilter } from '@/components/admin/url-select-filter';
import { useListQuery } from '@/components/admin/use-list-query';
import { FormSelect } from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, columnHelperFor, type AdminColumnDef } from '@/components/ui/data-table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SelectItem } from '@/components/ui/select';
import {
    EMPTY_ROLE_ASSIGNMENT_FORM,
    RoleAssignmentSchema,
    type RoleAssignmentFormValue,
    type RoleAssignmentSchemaValue,
} from '@/lib/admin/role-assignment-schema';

type UserOption = { id: string; firstName: string; lastName: string; email: string };
type RoleOption = {
    id: string;
    roleName: string;
    scopeType: 'INSTITUTION' | 'OFFERING';
};
type OfferingOption = {
    id: string;
    subject: { subjectCode: string };
    term: { year: number; session: number };
};

export type AssignmentListItem = {
    id: string;
    user: UserOption;
    role: RoleOption;
    offering: OfferingOption | null;
    granted: string;
    revoked: string | null;
    source: 'REQUEST' | 'MANUAL';
};

const column = columnHelperFor<AssignmentListItem>();
const ENDPOINT = '/api/admin/role-assignments';

const offeringLabel = (offering: OfferingOption) =>
    `${offering.subject.subjectCode} · ${offering.term.year} S${offering.term.session}`;

export function PeopleTable({
    assignments,
    users,
    roles,
    offerings,
    roleId,
    offeringId,
    status,
    page,
    pageCount,
    total,
    sort,
    dir,
}: {
    assignments: AssignmentListItem[];
    users: UserOption[];
    roles: RoleOption[];
    offerings: OfferingOption[];
    roleId: string | null;
    offeringId: string | null;
    status: 'active' | 'revoked' | 'all';
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
                column.accessor((row) => `${row.user.lastName}, ${row.user.firstName}`, {
                    id: 'user',
                    header: 'Person',
                    cell: (info) => (
                        <div className="flex flex-col">
                            <span className="font-medium">{info.getValue()}</span>
                            <span className="text-muted-foreground text-xs">
                                {info.row.original.user.email}
                            </span>
                        </div>
                    ),
                }),
                column.accessor((row) => row.role.roleName, {
                    id: 'role',
                    header: 'Role',
                    cell: (info) => (
                        <div className="flex items-center gap-2">
                            <span>{info.getValue()}</span>
                            <Badge variant="outline">
                                {info.row.original.role.scopeType === 'INSTITUTION'
                                    ? 'Institution'
                                    : 'Offering'}
                            </Badge>
                        </div>
                    ),
                }),
                column.accessor(
                    (row) => (row.offering ? offeringLabel(row.offering) : 'Institution-wide'),
                    {
                        id: 'scope',
                        header: 'Scope',
                        enableSorting: false,
                        cell: (info) => (
                            <span className="text-muted-foreground text-sm">
                                {info.getValue()}
                            </span>
                        ),
                    },
                ),
                column.accessor('granted', {
                    header: 'Granted',
                    cell: (info) => (
                        <div className="flex flex-col text-sm tabular-nums">
                            <span>{info.getValue()}</span>
                            <span className="text-muted-foreground text-xs">
                                {info.row.original.source === 'REQUEST' ? 'From request' : 'Manual'}
                            </span>
                        </div>
                    ),
                }),
                column.accessor('revoked', {
                    header: 'Status',
                    enableSorting: false,
                    cell: (info) =>
                        info.getValue() ? (
                            <Badge variant="secondary">Revoked {info.getValue()}</Badge>
                        ) : (
                            <Badge>Active</Badge>
                        ),
                }),
                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) => <AssignmentActions assignment={info.row.original} />,
                }),
            ] as Array<AdminColumnDef<AssignmentListItem>>,
        [],
    );

    return (
        <DataTable
            columns={columns}
            data={assignments}
            emptyMessage={
                list.input || roleId || offeringId || status !== 'active'
                    ? 'No role assignments match these filters.'
                    : 'No active role assignments yet.'
            }
            toolbar={
                <>
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search people…"
                        className="max-w-52"
                        aria-label="Search people"
                    />
                    <UrlSelectFilter
                        value={roleId}
                        options={roles.map((role) => ({ value: role.id, label: role.roleName }))}
                        placeholder="All roles"
                        ariaLabel="Filter by role"
                        onChange={(next) => list.setParams({ role: next, page: null })}
                    />
                    <UrlSelectFilter
                        value={offeringId}
                        options={offerings.map((offering) => ({
                            value: offering.id,
                            label: offeringLabel(offering),
                        }))}
                        placeholder="All scopes"
                        ariaLabel="Filter by offering"
                        onChange={(next) => list.setParams({ offering: next, page: null })}
                        className="w-52"
                    />
                    <UrlSelectFilter
                        value={status}
                        options={[
                            { value: 'active', label: 'Active only' },
                            { value: 'revoked', label: 'Revoked only' },
                            { value: 'all', label: 'All history' },
                        ]}
                        placeholder="Active only"
                        ariaLabel="Filter by assignment status"
                        clearable={false}
                        onChange={(next) =>
                            list.setParams({ status: next === 'active' ? null : next, page: null })
                        }
                    />
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {total} total
                    </span>
                    <div className="flex-1" />
                    <AssignmentDialog
                        users={users}
                        roles={roles}
                        offerings={offerings}
                        trigger={
                            <Button disabled={roles.length === 0 || users.length === 0}>
                                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                                Grant role
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

function AssignmentDialog({
    users,
    roles,
    offerings,
    trigger,
}: {
    users: UserOption[];
    roles: RoleOption[];
    offerings: OfferingOption[];
    trigger: ReactElement;
}) {
    return (
        <ResourceFormDialog<RoleAssignmentFormValue, RoleAssignmentSchemaValue>
            schema={RoleAssignmentSchema}
            emptyValues={EMPTY_ROLE_ASSIGNMENT_FORM}
            createEndpoint={ENDPOINT}
            title={{ create: 'Grant role', edit: 'Grant role' }}
            description={{
                create: 'Choose a person, role and the exact scope where it applies.',
                edit: 'Role assignments are revoked and re-granted rather than edited.',
            }}
            submitLabel={{ create: 'Grant role', edit: 'Grant role' }}
            trigger={trigger}
            fields={(form) => (
                <AssignmentFields form={form} users={users} roles={roles} offerings={offerings} />
            )}
        />
    );
}

function AssignmentFields({
    form,
    users,
    roles,
    offerings,
}: {
    form: UseFormReturn<RoleAssignmentFormValue, unknown, RoleAssignmentSchemaValue>;
    users: UserOption[];
    roles: RoleOption[];
    offerings: OfferingOption[];
}) {
    const roleId = useWatch({ control: form.control, name: 'roleId' });
    const previousRoleId = useRef(roleId);
    const selectedRole = roles.find((role) => role.id === roleId);

    useEffect(() => {
        if (previousRoleId.current === roleId) return;
        previousRoleId.current = roleId;
        form.setValue(
            'offeringId',
            selectedRole?.scopeType === 'INSTITUTION' ? 'institution' : '',
        );
    }, [form, roleId, selectedRole?.scopeType]);

    const scopeOptions =
        selectedRole?.scopeType === 'INSTITUTION'
            ? [{ value: 'institution', label: 'Institution-wide' }]
            : selectedRole?.scopeType === 'OFFERING'
              ? offerings.map((offering) => ({
                    value: offering.id,
                    label: offeringLabel(offering),
                }))
              : [];

    return (
        <>
            <FormSelect
                control={form.control}
                name="userId"
                label="Person"
                items={Object.fromEntries(
                    users.map((user) => [
                        user.id,
                        `${user.lastName}, ${user.firstName} · ${user.email}`,
                    ]),
                )}
            >
                {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                        {user.lastName}, {user.firstName} · {user.email}
                    </SelectItem>
                ))}
            </FormSelect>
            <FormSelect
                control={form.control}
                name="roleId"
                label="Role"
                items={Object.fromEntries(
                    roles.map((role) => [
                        role.id,
                        `${role.roleName} · ${role.scopeType === 'INSTITUTION' ? 'Institution' : 'Offering'}`,
                    ]),
                )}
            >
                {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                        {role.roleName} ·{' '}
                        {role.scopeType === 'INSTITUTION' ? 'Institution' : 'Offering'}
                    </SelectItem>
                ))}
            </FormSelect>
            <FormSelect
                control={form.control}
                name="offeringId"
                label="Scope"
                description="The available scope follows the selected role."
                items={Object.fromEntries(
                    scopeOptions.map((option) => [option.value, option.label]),
                )}
            >
                {scopeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </FormSelect>
        </>
    );
}

function AssignmentActions({ assignment }: { assignment: AssignmentListItem }) {
    if (assignment.revoked) return null;

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
                    <ResourceActionDialog
                        endpoint={`${ENDPOINT}/${assignment.id}/revoke`}
                        method="PATCH"
                        title={`Revoke ${assignment.role.roleName}?`}
                        description={`This removes the role from ${assignment.user.firstName} ${assignment.user.lastName} now, while keeping the grant in history.`}
                        confirmLabel="Revoke role"
                        destructive
                        trigger={
                            <DropdownMenuItem variant="destructive" closeOnClick={false}>
                                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                                Revoke
                            </DropdownMenuItem>
                        }
                    />
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
