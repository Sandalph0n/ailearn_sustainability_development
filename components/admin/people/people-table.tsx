'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    ArrowLeft02Icon,
    ArrowRight01Icon,
    Cancel01Icon,
    Delete02Icon,
    MoreVerticalIcon,
} from '@hugeicons/core-free-icons';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';

import { ResourceActionDialog } from '@/components/admin/resource-action-dialog';
import {
    ResourceFormPage,
    ResourceFormSection,
} from '@/components/admin/resource-form-page';
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
    EMPTY_ROLE_ASSIGNMENT_FORM,
    INSTITUTION_SCOPE_VALUE,
    RoleAssignmentSchema,
    UNSCOPED_OFFERING_VALUE,
    type RoleAssignmentFormValue,
    type RoleAssignmentSchemaValue,
} from '@/lib/admin/role-assignment-schema';

type UserOption = { id: string; firstName: string; lastName: string; email: string };
type RoleOption = {
    id: string;
    roleName: string;
    scopeType: 'INSTITUTION' | 'OFFERING';
    protected?: boolean;
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
    scopes: Array<{
        id: string;
        source: 'DIRECT' | 'CODE' | 'REQUEST_APPROVED';
        assignedBy: string | null;
        offering: OfferingOption;
    }>;
    granted: string;
    revoked: string | null;
    source: 'REQUEST' | 'MANUAL';
};

const column = columnHelperFor<AssignmentListItem>();
const ENDPOINT = '/api/admin/role-assignments';

const offeringLabel = (offering: OfferingOption) =>
    `${offering.subject.subjectCode} · ${offering.term.year} S${offering.term.session}`;

function assignmentScopeLabel(assignment: AssignmentListItem): string {
    if (assignment.role.scopeType === 'INSTITUTION') return 'Institution-wide';
    if (assignment.scopes.length === 0) return 'Not scoped yet';

    const [first, ...rest] = assignment.scopes;
    return rest.length === 0
        ? offeringLabel(first.offering)
        : `${offeringLabel(first.offering)} +${rest.length} more`;
}

export type PeopleRoleCapabilities = { create: boolean; revoke: boolean };
export type PeopleScopeCapabilities = { view: boolean; create: boolean; revoke: boolean };

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
    endpoint = ENDPOINT,
    contextQuery = '',
    canManage = true,
    roleCapabilities,
    scopeCapabilities = { view: false, create: false, revoke: false },
    roleFilterParam = 'role',
    canManageProtectedRoles = true,
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
    endpoint?: string;
    contextQuery?: string;
    canManage?: boolean;
    roleCapabilities?: PeopleRoleCapabilities;
    scopeCapabilities?: PeopleScopeCapabilities;
    roleFilterParam?: string;
    canManageProtectedRoles?: boolean;
}) {
    const list = useListQuery();
    const [granting, setGranting] = useState(false);
    const [managingScopes, setManagingScopes] = useState<AssignmentListItem | null>(null);
    const effectiveRoleCapabilities = roleCapabilities ?? {
        create: canManage,
        revoke: canManage,
    };

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
                            {info.row.original.role.protected && (
                                <Badge variant="secondary">Protected</Badge>
                            )}
                        </div>
                    ),
                }),
                column.accessor(
                    assignmentScopeLabel,
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
                    cell: (info) => {
                        const canRevokeAssignment =
                            effectiveRoleCapabilities.revoke &&
                            (!info.row.original.role.protected ||
                                canManageProtectedRoles === true);

                        return canRevokeAssignment ||
                            (scopeCapabilities.view &&
                                info.row.original.role.scopeType === 'OFFERING') ? (
                            <AssignmentActions
                                assignment={info.row.original}
                                endpoint={endpoint}
                                contextQuery={contextQuery}
                                canRevoke={canRevokeAssignment}
                                canManageScopes={scopeCapabilities.view}
                                canEditScopes={
                                    scopeCapabilities.create || scopeCapabilities.revoke
                                }
                                onManageScopes={() => setManagingScopes(info.row.original)}
                            />
                        ) : null;
                    },
                }),
            ] as Array<AdminColumnDef<AssignmentListItem>>,
        [
            canManageProtectedRoles,
            contextQuery,
            effectiveRoleCapabilities.revoke,
            endpoint,
            scopeCapabilities.create,
            scopeCapabilities.revoke,
            scopeCapabilities.view,
        ],
    );

    if (managingScopes) {
        return (
            <AssignmentScopesPanel
                assignment={managingScopes}
                offerings={offerings}
                endpoint={endpointFor(
                    `${endpoint}/${managingScopes.id}/scopes`,
                    contextQuery,
                )}
                capabilities={scopeCapabilities}
                onCancel={() => setManagingScopes(null)}
                onScopesChange={(scopes) =>
                    setManagingScopes((current) => (current ? { ...current, scopes } : current))
                }
            />
        );
    }

    if (granting) {
        return (
            <AssignmentForm
                users={users}
                roles={roles}
                offerings={offerings}
                endpoint={endpoint}
                contextQuery={contextQuery}
                onCancel={() => setGranting(false)}
            />
        );
    }

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
                        onChange={(next) =>
                            list.setParams({ [roleFilterParam]: next, page: null })
                        }
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
                    {effectiveRoleCapabilities.create && <Button
                        disabled={roles.length === 0 || users.length === 0}
                        onClick={() => setGranting(true)}
                    >
                        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                        Grant role
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

function AssignmentForm({
    users,
    roles,
    offerings,
    endpoint,
    contextQuery,
    onCancel,
}: {
    users: UserOption[];
    roles: RoleOption[];
    offerings: OfferingOption[];
    endpoint: string;
    contextQuery: string;
    onCancel: () => void;
}) {
    return (
        <ResourceFormPage<RoleAssignmentFormValue, RoleAssignmentSchemaValue>
            schema={RoleAssignmentSchema}
            emptyValues={EMPTY_ROLE_ASSIGNMENT_FORM}
            createEndpoint={endpointFor(endpoint, contextQuery)}
            title={{ create: 'Grant role', edit: 'Grant role' }}
            description={{
                create: 'Choose a person and role. An offering scope can be added now or later.',
                edit: 'Role assignments are revoked and re-granted rather than edited.',
            }}
            submitLabel={{ create: 'Grant role', edit: 'Grant role' }}
            onCancel={onCancel}
        >
            {(form) => (
                <ResourceFormSection
                    title="Assignment"
                    description="Choose who receives the role and optionally connect an offering-scoped role to its first offering."
                >
                    <AssignmentFields
                        form={form}
                        users={users}
                        roles={roles}
                        offerings={offerings}
                    />
                </ResourceFormSection>
            )}
        </ResourceFormPage>
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
            selectedRole?.scopeType === 'INSTITUTION'
                ? INSTITUTION_SCOPE_VALUE
                : selectedRole?.scopeType === 'OFFERING'
                  ? UNSCOPED_OFFERING_VALUE
                  : '',
        );
    }, [form, roleId, selectedRole?.scopeType]);

    const scopeOptions =
        selectedRole?.scopeType === 'INSTITUTION'
            ? [{ value: INSTITUTION_SCOPE_VALUE, label: 'Institution-wide' }]
            : selectedRole?.scopeType === 'OFFERING'
              ? [
                    { value: UNSCOPED_OFFERING_VALUE, label: 'No offering yet' },
                    ...offerings.map((offering) => ({
                        value: offering.id,
                        label: offeringLabel(offering),
                    })),
                ]
              : [];

    return (
        <div className="grid gap-5 lg:grid-cols-3">
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
                description={
                    selectedRole?.scopeType === 'OFFERING'
                        ? 'Optional. An offering scope can be added later.'
                        : 'The available scope follows the selected role.'
                }
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
        </div>
    );
}

function AssignmentActions({
    assignment,
    endpoint,
    contextQuery,
    canRevoke,
    canManageScopes,
    canEditScopes,
    onManageScopes,
}: {
    assignment: AssignmentListItem;
    endpoint: string;
    contextQuery: string;
    canRevoke: boolean;
    canManageScopes: boolean;
    canEditScopes: boolean;
    onManageScopes: () => void;
}) {
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
                    {canManageScopes && assignment.role.scopeType === 'OFFERING' && (
                        <DropdownMenuItem onClick={onManageScopes}>
                            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                            {canEditScopes ? 'Manage scopes' : 'View scopes'}
                        </DropdownMenuItem>
                    )}
                    {canManageScopes && canRevoke && <DropdownMenuSeparator />}
                    {canRevoke && <ResourceActionDialog
                        endpoint={endpointFor(`${endpoint}/${assignment.id}/revoke`, contextQuery)}
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
                    />}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

type AssignmentScope = AssignmentListItem['scopes'][number];

function AssignmentScopesPanel({
    assignment,
    offerings,
    endpoint,
    capabilities,
    onCancel,
    onScopesChange,
}: {
    assignment: AssignmentListItem;
    offerings: OfferingOption[];
    endpoint: string;
    capabilities: PeopleScopeCapabilities;
    onCancel: () => void;
    onScopesChange: (scopes: AssignmentScope[]) => void;
}) {
    const [offeringId, setOfferingId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const assignedOfferingIds = new Set(assignment.scopes.map((scope) => scope.offering.id));
    const availableOfferings = offerings.filter(
        (offering) => !assignedOfferingIds.has(offering.id),
    );

    async function addScope() {
        if (!offeringId || adding) return;
        setAdding(true);
        setError(null);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ offeringId }),
            });
            const body: unknown = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = responseError(body, 'Could not add this offering scope.');
                setError(message);
                toast.error(message);
                return;
            }

            const offering = offerings.find((option) => option.id === offeringId);
            const scope = responseScope(body);
            if (offering && scope) {
                onScopesChange([
                    ...assignment.scopes,
                    { id: scope.id, source: 'DIRECT', assignedBy: scope.assignedBy, offering },
                ]);
            }
            setOfferingId(null);
            toast.success('Offering scope added.');
        } catch {
            const message = 'Cannot reach the server. Check your connection.';
            setError(message);
            toast.error(message);
        } finally {
            setAdding(false);
        }
    }

    return (
        <section className="bg-background -mx-5 min-h-[calc(100dvh-4rem)] px-5 pb-10 md:-mx-6 md:px-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col">
                <header className="border-border flex flex-wrap items-start gap-4 border-b py-6">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={onCancel}
                        aria-label="Back to people"
                        className="mt-0.5 -ml-2"
                    >
                        <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} />
                    </Button>
                    <div className="min-w-0 flex-1">
                        <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                            Access scope
                        </p>
                        <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
                            {capabilities.create || capabilities.revoke ? 'Manage' : 'View'}{' '}
                            {assignment.role.roleName} scopes
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {assignment.user.firstName} {assignment.user.lastName} ·{' '}
                            {assignment.user.email}
                        </p>
                    </div>
                </header>

                <div
                    className={
                        'grid items-start gap-8 py-7 ' +
                        (capabilities.create
                            ? 'lg:grid-cols-[minmax(18rem,0.75fr)_minmax(28rem,1.25fr)]'
                            : '')
                    }
                >
                    {capabilities.create && (
                        <section>
                            <h3 className="font-heading text-sm font-semibold">
                                Add direct scope
                            </h3>
                            <p className="text-muted-foreground mt-1 text-sm leading-6">
                                Connect this role assignment to another offering at the same
                                institution.
                            </p>
                            <div className="mt-4 space-y-3">
                                <Select
                                    items={Object.fromEntries(
                                        availableOfferings.map((offering) => [
                                            offering.id,
                                            offeringLabel(offering),
                                        ]),
                                    )}
                                    value={offeringId}
                                    onValueChange={setOfferingId}
                                    disabled={
                                        !capabilities.create || availableOfferings.length === 0
                                    }
                                >
                                    <SelectTrigger className="w-full" aria-label="Offering to add">
                                        <SelectValue
                                            placeholder={
                                                availableOfferings.length === 0
                                                    ? 'All offerings are already assigned'
                                                    : 'Choose an offering'
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableOfferings.map((offering) => (
                                            <SelectItem key={offering.id} value={offering.id}>
                                                {offeringLabel(offering)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    onClick={() => void addScope()}
                                    disabled={!offeringId || adding || !capabilities.create}
                                >
                                    {adding ? (
                                        <Spinner />
                                    ) : (
                                        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                                    )}
                                    Add scope
                                </Button>
                                {error && (
                                    <p
                                        role="alert"
                                        className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
                                    >
                                        {error}
                                    </p>
                                )}
                            </div>
                        </section>
                    )}

                    <section>
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <h3 className="font-heading text-sm font-semibold">Assigned offerings</h3>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    Each row is one independent scope for this role.
                                </p>
                            </div>
                            <span className="text-muted-foreground text-sm tabular-nums">
                                {assignment.scopes.length} total
                            </span>
                        </div>
                        <div className="mt-4 overflow-hidden rounded-xl border">
                            {assignment.scopes.length === 0 ? (
                                <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                                    This role is active but has not been scoped to an offering yet.
                                </p>
                            ) : (
                                assignment.scopes.map((scope) => (
                                    <div
                                        key={scope.id}
                                        className="border-border flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium">{offeringLabel(scope.offering)}</p>
                                            <p className="text-muted-foreground mt-0.5 text-xs">
                                                {scopeSourceLabel(scope)}
                                            </p>
                                        </div>
                                        {capabilities.revoke && (
                                            <ResourceActionDialog
                                                endpoint={scopeEndpoint(endpoint, scope.id)}
                                                method="PATCH"
                                                title={`Remove ${offeringLabel(scope.offering)}?`}
                                                description="This role will stop applying to this offering. The role assignment itself remains active."
                                                confirmLabel="Remove scope"
                                                destructive
                                                onCompleted={() =>
                                                    onScopesChange(
                                                        assignment.scopes.filter(
                                                            (current) => current.id !== scope.id,
                                                        ),
                                                    )
                                                }
                                                trigger={
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        className="text-destructive"
                                                        aria-label={`Remove ${offeringLabel(scope.offering)}`}
                                                    >
                                                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                                                    </Button>
                                                }
                                            />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </section>
    );
}

function scopeSourceLabel(scope: AssignmentScope): string {
    if (scope.source === 'CODE') return 'Assigned with a one-time access code';
    if (scope.source === 'REQUEST_APPROVED') return 'Approved subject access request';
    return scope.assignedBy ? `Granted directly by ${scope.assignedBy}` : 'Granted directly';
}

function scopeEndpoint(baseEndpoint: string, scopeId: string): string {
    const [path, query] = baseEndpoint.split('?');
    return `${path}/${scopeId}${query ? `?${query}` : ''}`;
}

function responseError(body: unknown, fallback: string): string {
    if (
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'object' &&
        body.error !== null &&
        'message' in body.error &&
        typeof body.error.message === 'string'
    ) {
        return body.error.message;
    }
    return fallback;
}

function responseScope(body: unknown): { id: string; assignedBy: string | null } | null {
    if (typeof body !== 'object' || body === null || !('scope' in body)) return null;
    const scope = body.scope;
    if (typeof scope !== 'object' || scope === null || !('id' in scope) || typeof scope.id !== 'string') {
        return null;
    }
    const assignedBy =
        'assignedBy' in scope && typeof scope.assignedBy === 'string' ? scope.assignedBy : null;
    return { id: scope.id, assignedBy };
}

function endpointFor(path: string, query: string): string {
    return query ? `${path}?${query}` : path;
}
