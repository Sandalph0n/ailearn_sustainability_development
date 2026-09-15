'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    ArrowLeft02Icon,
    ArrowRight01Icon,
    Cancel01Icon,
    UserMultipleIcon,
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
import { FormCombobox } from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, columnHelperFor, type AdminColumnDef } from '@/components/ui/data-table';
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
import { cn } from '@/lib/utils';

type UserOption = { id: string; firstName: string; lastName: string; email: string };
type RoleOption = {
    id: string;
    roleName: string;
    scopeType: 'INSTITUTION' | 'OFFERING';
    protected?: boolean;
};
type OfferingOption = {
    id: string;
    subject: { subjectCode: string; subjectName: string };
    term: { year: number; session: number };
};

export type AssignmentListItem = {
    id: string;
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

export type PersonListItem = {
    user: UserOption;
    assignments: AssignmentListItem[];
};

const column = columnHelperFor<PersonListItem>();
const ENDPOINT = '/api/admin/role-assignments';

const offeringLabel = (offering: OfferingOption) =>
    `${offering.subject.subjectCode} · ${offering.term.year} S${offering.term.session}`;

function personName(user: UserOption): string {
    return `${user.lastName}, ${user.firstName}`;
}

function coverageSummary(person: PersonListItem): string {
    const active = person.assignments.filter((assignment) => !assignment.revoked);
    const institutionRoles = active.filter(
        (assignment) => assignment.role.scopeType === 'INSTITUTION',
    ).length;
    const offeringScopes = active.reduce(
        (sum, assignment) =>
            sum + (assignment.role.scopeType === 'OFFERING' ? assignment.scopes.length : 0),
        0,
    );

    const parts = [];
    if (institutionRoles) parts.push(`${institutionRoles} institution-wide`);
    if (offeringScopes) parts.push(`${offeringScopes} offering ${offeringScopes === 1 ? 'scope' : 'scopes'}`);
    return parts.join(' · ') || 'No active scope';
}

export type PeopleRoleCapabilities = { create: boolean; revoke: boolean };
export type PeopleScopeCapabilities = { view: boolean; create: boolean; revoke: boolean };

export function PeopleTable({
    people,
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
    scopeCapabilities,
    roleFilterParam = 'role',
    canManageProtectedRoles = true,
}: {
    people: PersonListItem[];
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
    const [selectedPerson, setSelectedPerson] = useState<PersonListItem | null>(null);
    const effectiveRoleCapabilities = roleCapabilities ?? {
        create: canManage,
        revoke: canManage,
    };
    const effectiveScopeCapabilities = scopeCapabilities ?? {
        view: canManage,
        create: canManage,
        revoke: canManage,
    };

    const columns = useMemo(
        () =>
            [
                column.accessor((row) => personName(row.user), {
                    id: 'user',
                    header: 'Person',
                    cell: (info) => (
                        <button
                            type="button"
                            onClick={() => setSelectedPerson(info.row.original)}
                            className="group flex w-full min-w-56 items-center gap-3 text-left"
                        >
                            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                                <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} className="size-4" />
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span className="group-hover:text-primary truncate font-medium transition-colors">
                                    {info.getValue()}
                                </span>
                                <span className="text-muted-foreground truncate text-xs">
                                    {info.row.original.user.email}
                                </span>
                            </span>
                        </button>
                    ),
                }),
                column.accessor((row) => row.assignments.length, {
                    id: 'roles',
                    header: 'Roles at institution',
                    enableSorting: false,
                    cell: (info) => {
                        const assignments = info.row.original.assignments;
                        return (
                            <div className="flex max-w-xl flex-wrap gap-1.5">
                                {assignments.slice(0, 3).map((assignment) => (
                                    <Badge
                                        key={assignment.id}
                                        variant={assignment.revoked ? 'secondary' : 'outline'}
                                    >
                                        {assignment.role.roleName}
                                    </Badge>
                                ))}
                                {assignments.length > 3 && (
                                    <Badge variant="secondary">+{assignments.length - 3}</Badge>
                                )}
                            </div>
                        );
                    },
                }),
                column.accessor(coverageSummary, {
                    id: 'coverage',
                    header: 'Current coverage',
                    enableSorting: false,
                    cell: (info) => (
                        <span className="text-muted-foreground text-sm">{info.getValue()}</span>
                    ),
                }),
                column.display({
                    id: 'open',
                    header: '',
                    cell: (info) => (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPerson(info.row.original)}
                        >
                            View access
                            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                        </Button>
                    ),
                }),
            ] as Array<AdminColumnDef<PersonListItem>>,
        [],
    );

    if (selectedPerson) {
        return (
            <PersonAccessPanel
                person={selectedPerson}
                offerings={offerings}
                endpoint={endpoint}
                contextQuery={contextQuery}
                status={status}
                roleCapabilities={effectiveRoleCapabilities}
                scopeCapabilities={effectiveScopeCapabilities}
                canManageProtectedRoles={canManageProtectedRoles}
                onCancel={() => setSelectedPerson(null)}
                onPersonChange={setSelectedPerson}
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
            data={people}
            emptyMessage={
                list.input || roleId || offeringId || status !== 'active'
                    ? 'No people match these access filters.'
                    : 'No one has an active role at this institution yet.'
            }
            toolbar={
                <>
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search people or roles…"
                        className="max-w-56"
                        aria-label="Search people or roles"
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
                        placeholder="All offering scopes"
                        ariaLabel="Filter by offering"
                        onChange={(next) => list.setParams({ offering: next, page: null })}
                        className="w-56"
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
                        {total} {total === 1 ? 'person' : 'people'}
                    </span>
                    <div className="flex-1" />
                    {effectiveRoleCapabilities.create && (
                        <Button
                            disabled={roles.length === 0 || users.length === 0}
                            onClick={() => setGranting(true)}
                        >
                            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                            Grant role
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
            <FormCombobox
                control={form.control}
                name="userId"
                label="Person"
                placeholder="Search by name or email"
                emptyText="No person found."
                options={users.map((user) => ({
                    value: user.id,
                    label: `${user.lastName}, ${user.firstName}`,
                    description: user.email,
                }))}
            />
            <FormCombobox
                control={form.control}
                name="roleId"
                label="Role"
                placeholder="Search roles"
                emptyText="No role found."
                options={roles.map((role) => ({
                    value: role.id,
                    label: role.roleName,
                    description:
                        role.scopeType === 'INSTITUTION' ? 'Institution-wide' : 'Offering-scoped',
                }))}
            />
            <FormCombobox
                control={form.control}
                name="offeringId"
                label="Scope"
                description={
                    selectedRole?.scopeType === 'OFFERING'
                        ? 'Optional. An offering scope can be added later.'
                        : 'The available scope follows the selected role.'
                }
                placeholder={selectedRole ? 'Search available scope' : 'Choose a role first'}
                emptyText="No offering found."
                disabled={!selectedRole}
                options={scopeOptions}
            />
        </div>
    );
}

function PersonAccessPanel({
    person,
    offerings,
    endpoint,
    contextQuery,
    status,
    roleCapabilities,
    scopeCapabilities,
    canManageProtectedRoles,
    onCancel,
    onPersonChange,
}: {
    person: PersonListItem;
    offerings: OfferingOption[];
    endpoint: string;
    contextQuery: string;
    status: 'active' | 'revoked' | 'all';
    roleCapabilities: PeopleRoleCapabilities;
    scopeCapabilities: PeopleScopeCapabilities;
    canManageProtectedRoles: boolean;
    onCancel: () => void;
    onPersonChange: (person: PersonListItem) => void;
}) {
    const [selectedAssignmentId, setSelectedAssignmentId] = useState(
        () => person.assignments.find((assignment) => !assignment.revoked)?.id ?? person.assignments[0]?.id,
    );
    const selectedAssignment =
        person.assignments.find((assignment) => assignment.id === selectedAssignmentId) ??
        person.assignments[0];

    function updateAssignment(
        assignmentId: string,
        update: (assignment: AssignmentListItem) => AssignmentListItem,
    ) {
        onPersonChange({
            ...person,
            assignments: person.assignments.map((assignment) =>
                assignment.id === assignmentId ? update(assignment) : assignment,
            ),
        });
    }

    function completeRoleRevoke(assignmentId: string) {
        if (status === 'active') {
            const assignments = person.assignments.filter(
                (assignment) => assignment.id !== assignmentId,
            );
            if (assignments.length === 0) {
                onCancel();
                return;
            }
            onPersonChange({ ...person, assignments });
            setSelectedAssignmentId(assignments[0].id);
            return;
        }
        updateAssignment(assignmentId, (assignment) => ({ ...assignment, revoked: 'Just now' }));
    }

    return (
        <section className="bg-background -mx-5 min-h-[calc(100dvh-4rem)] px-5 pb-10 md:-mx-6 md:px-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col">
                <header className="border-border flex items-start gap-4 border-b py-6">
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
                            Person access
                        </p>
                        <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
                            {person.user.firstName} {person.user.lastName}
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm">{person.user.email}</p>
                    </div>
                </header>

                <div className="grid min-h-[30rem] border-x border-b lg:grid-cols-[minmax(18rem,0.78fr)_minmax(30rem,1.22fr)]">
                    <section className="border-border border-b p-5 lg:border-r lg:border-b-0">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <h3 className="font-heading text-sm font-semibold">Roles at institution</h3>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    Select a role to inspect its access.
                                </p>
                            </div>
                            <span className="text-muted-foreground text-xs tabular-nums">
                                {person.assignments.length}
                            </span>
                        </div>
                        <div className="mt-4 space-y-2">
                            {person.assignments.map((assignment) => (
                                <button
                                    type="button"
                                    key={assignment.id}
                                    onClick={() => setSelectedAssignmentId(assignment.id)}
                                    className={cn(
                                        'border-border hover:border-primary/40 flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors',
                                        selectedAssignment?.id === assignment.id &&
                                            'border-primary/55 bg-primary/[0.055]',
                                    )}
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="truncate font-medium">
                                                {assignment.role.roleName}
                                            </span>
                                            <Badge variant="outline">
                                                {assignment.role.scopeType === 'INSTITUTION'
                                                    ? 'Institution'
                                                    : 'Offering'}
                                            </Badge>
                                            {assignment.revoked && (
                                                <Badge variant="secondary">Revoked</Badge>
                                            )}
                                        </span>
                                        <span className="text-muted-foreground mt-1 block text-xs">
                                            Granted {assignment.granted}
                                            {assignment.source === 'REQUEST' ? ' from request' : ''}
                                        </span>
                                    </span>
                                    <HugeiconsIcon
                                        icon={ArrowRight01Icon}
                                        strokeWidth={2}
                                        className="text-muted-foreground size-4 shrink-0"
                                    />
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="p-5 md:p-6">
                        {selectedAssignment ? (
                            <RoleAccessDetail
                                person={person.user}
                                assignment={selectedAssignment}
                                offerings={offerings}
                                scopeEndpoint={endpointFor(
                                    `${endpoint}/${selectedAssignment.id}/scopes`,
                                    contextQuery,
                                )}
                                roleRevokeEndpoint={endpointFor(
                                    `${endpoint}/${selectedAssignment.id}/revoke`,
                                    contextQuery,
                                )}
                                canRevokeRole={
                                    roleCapabilities.revoke &&
                                    (!selectedAssignment.role.protected || canManageProtectedRoles)
                                }
                                scopeCapabilities={scopeCapabilities}
                                onScopesChange={(scopes) =>
                                    updateAssignment(selectedAssignment.id, (assignment) => ({
                                        ...assignment,
                                        scopes,
                                    }))
                                }
                                onRoleRevoked={() => completeRoleRevoke(selectedAssignment.id)}
                            />
                        ) : (
                            <p className="text-muted-foreground py-16 text-center text-sm">
                                Select a role to inspect its access.
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </section>
    );
}

type AssignmentScope = AssignmentListItem['scopes'][number];

function RoleAccessDetail({
    person,
    assignment,
    offerings,
    scopeEndpoint,
    roleRevokeEndpoint,
    canRevokeRole,
    scopeCapabilities,
    onScopesChange,
    onRoleRevoked,
}: {
    person: UserOption;
    assignment: AssignmentListItem;
    offerings: OfferingOption[];
    scopeEndpoint: string;
    roleRevokeEndpoint: string;
    canRevokeRole: boolean;
    scopeCapabilities: PeopleScopeCapabilities;
    onScopesChange: (scopes: AssignmentScope[]) => void;
    onRoleRevoked: () => void;
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
            const response = await fetch(scopeEndpoint, {
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
            toast.success('Offering access added.');
        } catch {
            const message = 'Cannot reach the server. Check your connection.';
            setError(message);
            toast.error(message);
        } finally {
            setAdding(false);
        }
    }

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-lg font-semibold">
                            {assignment.role.roleName}
                        </h3>
                        <Badge variant="outline">
                            {assignment.role.scopeType === 'INSTITUTION'
                                ? 'Institution-wide'
                                : 'Offering-scoped'}
                        </Badge>
                        {assignment.role.protected && <Badge variant="secondary">Protected</Badge>}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {assignment.revoked
                            ? `Revoked ${assignment.revoked}`
                            : assignment.role.scopeType === 'INSTITUTION'
                              ? 'This role applies across the institution.'
                              : scopeCapabilities.revoke
                                ? 'Each offering below can be revoked independently.'
                                : 'This role is scoped to the offerings listed below.'}
                    </p>
                </div>
                {!assignment.revoked && canRevokeRole && (
                    <ResourceActionDialog
                        endpoint={roleRevokeEndpoint}
                        method="PATCH"
                        title={`Revoke ${assignment.role.roleName}?`}
                        description={`This removes the entire role from ${person.firstName} ${person.lastName}, including all of its offering access. The grant remains in history.`}
                        confirmLabel="Revoke role"
                        destructive
                        onCompleted={onRoleRevoked}
                        trigger={
                            <Button variant="outline" size="sm" className="text-destructive">
                                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                                Revoke role
                            </Button>
                        }
                    />
                )}
            </div>

            {assignment.role.scopeType === 'INSTITUTION' ? (
                <div className="border-primary/25 bg-primary/[0.045] mt-5 rounded-lg border px-5 py-6">
                    <p className="font-medium">Institution-wide access</p>
                    <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
                        This role is not tied to individual offerings. Revoke the role itself to
                        remove this person&apos;s access.
                    </p>
                </div>
            ) : (
                <div className="mt-5 space-y-5">
                    {!assignment.revoked && scopeCapabilities.create && (
                        <div className="grid gap-3 border-b pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                            <div>
                                <label className="text-sm font-medium">Add offering access</label>
                                <Select
                                    items={Object.fromEntries(
                                        availableOfferings.map((offering) => [
                                            offering.id,
                                            offeringLabel(offering),
                                        ]),
                                    )}
                                    value={offeringId}
                                    onValueChange={setOfferingId}
                                    disabled={availableOfferings.length === 0}
                                >
                                    <SelectTrigger className="mt-2 w-full" aria-label="Offering to add">
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
                            </div>
                            <Button
                                type="button"
                                onClick={() => void addScope()}
                                disabled={!offeringId || adding}
                            >
                                {adding ? (
                                    <Spinner />
                                ) : (
                                    <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                                )}
                                Add access
                            </Button>
                        </div>
                    )}

                    {error && (
                        <p
                            role="alert"
                            className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
                        >
                            {error}
                        </p>
                    )}

                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <h4 className="font-heading text-sm font-semibold">Offering access</h4>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Active scopes attached to this role assignment.
                            </p>
                        </div>
                        <span className="text-muted-foreground text-sm tabular-nums">
                            {assignment.scopes.length} total
                        </span>
                    </div>

                    {!scopeCapabilities.view ? (
                        <p className="text-muted-foreground border-border rounded-lg border px-5 py-8 text-center text-sm">
                            You do not have permission to inspect offering scopes.
                        </p>
                    ) : assignment.scopes.length === 0 ? (
                        <p className="text-muted-foreground border-border rounded-lg border px-5 py-8 text-center text-sm">
                            This role has not been connected to an offering yet.
                        </p>
                    ) : (
                        <div className="border-border overflow-hidden rounded-lg border">
                            {assignment.scopes.map((scope) => (
                                <div
                                    key={scope.id}
                                    className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-3.5 last:border-b-0"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium">{offeringLabel(scope.offering)}</p>
                                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                            {scope.offering.subject.subjectName} · {scopeSourceLabel(scope)}
                                        </p>
                                    </div>
                                    {!assignment.revoked && scopeCapabilities.revoke && (
                                        <ResourceActionDialog
                                            endpoint={scopeEndpointWithId(scopeEndpoint, scope.id)}
                                            method="PATCH"
                                            title={`Revoke access to ${offeringLabel(scope.offering)}?`}
                                            description={`Only this offering will be removed from ${person.firstName} ${person.lastName}'s ${assignment.role.roleName} role. Other offering scopes remain active.`}
                                            confirmLabel="Revoke access"
                                            destructive
                                            onCompleted={() =>
                                                onScopesChange(
                                                    assignment.scopes.filter(
                                                        (current) => current.id !== scope.id,
                                                    ),
                                                )
                                            }
                                            trigger={
                                                <Button variant="ghost" size="sm" className="text-destructive">
                                                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                                                    Revoke
                                                </Button>
                                            }
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function scopeSourceLabel(scope: AssignmentScope): string {
    if (scope.source === 'CODE') return 'Assigned with a one-time access code';
    if (scope.source === 'REQUEST_APPROVED') return 'Approved subject access request';
    return scope.assignedBy ? `Granted directly by ${scope.assignedBy}` : 'Granted directly';
}

function scopeEndpointWithId(baseEndpoint: string, scopeId: string): string {
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
    if (
        typeof scope !== 'object' ||
        scope === null ||
        !('id' in scope) ||
        typeof scope.id !== 'string'
    ) {
        return null;
    }
    const assignedBy =
        'assignedBy' in scope && typeof scope.assignedBy === 'string' ? scope.assignedBy : null;
    return { id: scope.id, assignedBy };
}

function endpointFor(path: string, query: string): string {
    return query ? `${path}?${query}` : path;
}
