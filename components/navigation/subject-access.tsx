'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Add01Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    BookOpen01Icon,
    Clock01Icon,
    Tick02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from '@/components/ui/combobox';
import { Spinner } from '@/components/ui/spinner';

export type SubjectAccessOffering = {
    id: string;
    subjectCode: string;
    subjectName: string;
    year: number;
    session: number;
    institutionId: string;
};

export type SubjectAccessRole = {
    assignmentId: string;
    scopeType: 'INSTITUTION' | 'OFFERING';
    roleName: string;
    institution: { id: string; name: string };
    scopes: Array<{
        id: string;
        source: 'DIRECT' | 'CODE' | 'REQUEST_APPROVED';
        offering: SubjectAccessOffering;
    }>;
    pendingRequests: Array<{
        id: string;
        offering: SubjectAccessOffering;
    }>;
};

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

function offeringLabel(offering: SubjectAccessOffering): string {
    return `${offering.subjectCode} · ${offering.subjectName} · Session ${offering.session} ${offering.year}`;
}

export function SubjectAccess({
    roles,
    offerings,
    initialAssignmentId,
}: {
    roles: SubjectAccessRole[];
    offerings: SubjectAccessOffering[];
    initialAssignmentId: string | null;
}) {
    const router = useRouter();
    const [adding, setAdding] = useState(false);
    const [assignmentId, setAssignmentId] = useState(initialAssignmentId);
    const [offering, setOffering] = useState<SubjectAccessOffering | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedRole = roles.find((role) => role.assignmentId === assignmentId) ?? null;
    const availableOfferings = useMemo(() => {
        if (!selectedRole) return [];

        const unavailable = new Set([
            ...selectedRole.scopes.map((scope) => scope.offering.id),
            ...selectedRole.pendingRequests.map((request) => request.offering.id),
        ]);
        return offerings.filter(
            (candidate) =>
                candidate.institutionId === selectedRole.institution.id &&
                !unavailable.has(candidate.id),
        );
    }, [offerings, selectedRole]);

    function chooseRole(nextAssignmentId: string | null) {
        setAssignmentId(nextAssignmentId);
        setAdding(false);
        setOffering(null);
        setError(null);
    }

    function startAdding() {
        if (selectedRole?.scopeType !== 'OFFERING') return;
        setOffering(null);
        setError(null);
        setAdding(true);
    }

    async function submit() {
        if (!assignmentId || !offering || submitting) return;

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/scope-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleAssignmentId: assignmentId, offeringId: offering.id }),
            });
            const body: unknown = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = responseError(body, 'Could not send the subject access request.');
                setError(message);
                toast.error(message);
                return;
            }

            toast.success('Subject access request sent for review.');
            setOffering(null);
            setAdding(false);
            router.refresh();
        } catch {
            const message = 'Cannot reach the server. Check your connection.';
            setError(message);
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    }

    if (roles.length === 0) {
        return (
            <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-4xl items-center py-10 sm:py-16">
                <section className="bg-card flex w-full flex-col gap-6 rounded-xl border p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
                    <div className="bg-brand-teal/10 text-brand-teal flex size-11 shrink-0 items-center justify-center rounded-lg">
                        <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="font-heading text-lg font-semibold">
                            An offering role is required
                        </h1>
                        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
                            Subject access is attached to roles such as learner, tutor or convenor.
                            Request an offering role before joining a subject.
                        </p>
                    </div>
                    <Link
                        href="/navigation/roles"
                        className={buttonVariants({ size: 'lg', className: 'self-start sm:self-auto' })}
                    >
                        Manage roles
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <main className="mx-auto w-full max-w-6xl py-8 sm:py-12">
            <header className="mb-7">
                <div>
                    <p className="text-brand-teal mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
                        Access coverage
                    </p>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                        Subject access
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                        See whether a role covers the whole institution or selected offerings.
                    </p>
                </div>
            </header>

            <section className="bg-card grid min-h-120 overflow-hidden rounded-xl border shadow-sm lg:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.25fr)]">
                <div className="bg-muted/25 border-b p-5 lg:border-r lg:border-b-0 sm:p-6">
                    <h2 className="font-heading font-semibold">Institution and role</h2>
                    <p className="text-muted-foreground mt-0.5 mb-4 text-xs">
                        Choose the role whose subject access you want to inspect.
                    </p>
                    <ul className="space-y-2" aria-label="Access roles">
                        {roles.map((role) => {
                            const selected = role.assignmentId === assignmentId;
                            return (
                                <li key={role.assignmentId}>
                                    <button
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => chooseRole(role.assignmentId)}
                                        className={
                                            'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ' +
                                            (selected
                                                ? 'border-brand-teal/50 bg-brand-teal/8'
                                                : 'bg-card hover:border-brand-teal/30 hover:bg-muted/40')
                                        }
                                    >
                                        <span className="bg-brand-teal/10 text-brand-teal flex size-9 shrink-0 items-center justify-center rounded-md">
                                            <HugeiconsIcon
                                                icon={BookOpen01Icon}
                                                strokeWidth={2}
                                                className="size-4"
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">
                                                {role.roleName}
                                            </span>
                                            <span className="text-muted-foreground block truncate text-xs">
                                                {role.institution.name}
                                            </span>
                                            <Badge variant="outline" className="mt-1.5">
                                                {role.scopeType === 'INSTITUTION'
                                                    ? 'Institution-wide'
                                                    : 'Offering-scoped'}
                                            </Badge>
                                        </span>
                                        {selected && (
                                            <HugeiconsIcon
                                                icon={Tick02Icon}
                                                strokeWidth={2}
                                                className="text-brand-teal size-4 shrink-0"
                                            />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="p-5 sm:p-6">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="font-heading font-semibold">
                                {adding ? 'Add access for' : 'Access as'} {selectedRole?.roleName}
                            </h2>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                                {selectedRole?.institution.name}
                            </p>
                        </div>

                        {selectedRole?.scopeType === 'OFFERING' &&
                            (adding ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={submitting}
                                    onClick={() => {
                                        setAdding(false);
                                        setOffering(null);
                                        setError(null);
                                    }}
                                >
                                    <HugeiconsIcon
                                        icon={ArrowLeft01Icon}
                                        strokeWidth={2}
                                        data-icon="inline-start"
                                    />
                                    Cancel
                                </Button>
                            ) : (
                                <Button type="button" onClick={startAdding}>
                                    <HugeiconsIcon
                                        icon={Add01Icon}
                                        strokeWidth={2}
                                        data-icon="inline-start"
                                    />
                                    Request subject access
                                </Button>
                            ))}
                    </div>

                    {adding && selectedRole?.scopeType === 'OFFERING' ? (
                        <div className="bg-muted/20 rounded-lg border p-5 sm:p-6">
                            <div className="max-w-2xl space-y-2">
                                <label htmlFor="subject-offering" className="text-sm font-medium">
                                    Subject offering
                                </label>
                                <Combobox
                                    items={availableOfferings}
                                    value={offering}
                                    onValueChange={setOffering}
                                    itemToStringLabel={offeringLabel}
                                    itemToStringValue={(item: SubjectAccessOffering) => item.id}
                                    isItemEqualToValue={(
                                        item: SubjectAccessOffering,
                                        value: SubjectAccessOffering,
                                    ) => item.id === value.id}
                                >
                                    <ComboboxInput
                                        id="subject-offering"
                                        className="w-full"
                                        placeholder="Search by subject code or name"
                                        showClear
                                    />
                                    <ComboboxContent>
                                        <ComboboxEmpty>No available offering found.</ComboboxEmpty>
                                        <ComboboxList>
                                            {(item: SubjectAccessOffering) => (
                                                <ComboboxItem key={item.id} value={item}>
                                                    <span className="flex min-w-0 flex-col">
                                                        <span className="truncate font-medium">
                                                            {item.subjectCode} · {item.subjectName}
                                                        </span>
                                                        <span className="text-muted-foreground text-xs">
                                                            Session {item.session} {item.year}
                                                        </span>
                                                    </span>
                                                </ComboboxItem>
                                            )}
                                        </ComboboxList>
                                    </ComboboxContent>
                                </Combobox>
                                <p className="text-muted-foreground text-xs">
                                    The request will be attached to {selectedRole.roleName} at{' '}
                                    {selectedRole.institution.name}. Access starts after approval.
                                </p>
                            </div>

                            {error && (
                                <p
                                    role="alert"
                                    className="border-destructive/30 bg-destructive/10 text-destructive mt-5 rounded-lg border px-3 py-2 text-sm"
                                >
                                    {error}
                                </p>
                            )}

                            <div className="mt-6 flex justify-end">
                                <Button
                                    type="button"
                                    disabled={submitting || !offering}
                                    onClick={() => void submit()}
                                >
                                    {submitting ? (
                                        <Spinner />
                                    ) : (
                                        <HugeiconsIcon
                                            icon={ArrowRight01Icon}
                                            strokeWidth={2}
                                            data-icon="inline-start"
                                        />
                                    )}
                                    Send request
                                </Button>
                            </div>
                        </div>
                    ) : selectedRole?.scopeType === 'INSTITUTION' ? (
                        <div className="border-brand-teal/30 bg-brand-teal/5 flex min-h-64 flex-col justify-center rounded-lg border p-6 sm:p-8">
                            <div className="bg-brand-teal/12 text-brand-teal mb-4 flex size-11 items-center justify-center rounded-lg">
                                <HugeiconsIcon
                                    icon={BookOpen01Icon}
                                    strokeWidth={2}
                                    className="size-5"
                                />
                            </div>
                            <Badge variant="outline" className="mb-3 w-fit">
                                Institution-wide role
                            </Badge>
                            <h3 className="font-heading text-lg font-semibold">
                                {selectedRole.roleName} covers the whole institution
                            </h3>
                            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
                                Any offering-level permission granted by this role applies to every
                                current and future offering at {selectedRole.institution.name}. It
                                does not need individual subject scopes or access codes.
                            </p>
                            <p className="text-foreground mt-5 text-sm font-medium tabular-nums">
                                {
                                    offerings.filter(
                                        (candidate) =>
                                            candidate.institutionId === selectedRole.institution.id,
                                    ).length
                                }{' '}
                                current offerings covered
                            </p>
                        </div>
                    ) : (
                        <>
                            <ul className="space-y-3" aria-label="Subject access records">
                                {selectedRole?.scopes.map((scope) => (
                                    <li
                                        key={scope.id}
                                        className="flex items-start gap-3 rounded-lg border p-4"
                                    >
                                        <span className="bg-brand-teal/10 text-brand-teal flex size-9 shrink-0 items-center justify-center rounded-md">
                                            <HugeiconsIcon
                                                icon={BookOpen01Icon}
                                                strokeWidth={2}
                                                className="size-4"
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-medium">
                                                {scope.offering.subjectCode} ·{' '}
                                                {scope.offering.subjectName}
                                            </span>
                                            <span className="text-muted-foreground mt-0.5 block text-sm">
                                                Session {scope.offering.session}{' '}
                                                {scope.offering.year}
                                            </span>
                                        </span>
                                        <Badge variant="outline">
                                            {scope.source === 'CODE'
                                                ? 'Access code'
                                                : scope.source === 'REQUEST_APPROVED'
                                                  ? 'Approved request'
                                                  : 'Assigned directly'}
                                        </Badge>
                                    </li>
                                ))}

                                {selectedRole?.pendingRequests.map((request) => (
                                    <li
                                        key={request.id}
                                        className="border-brand-amber/30 bg-brand-amber/5 flex items-start gap-3 rounded-lg border p-4"
                                    >
                                        <span className="bg-brand-amber/10 text-brand-amber flex size-9 shrink-0 items-center justify-center rounded-md">
                                            <HugeiconsIcon
                                                icon={Clock01Icon}
                                                strokeWidth={2}
                                                className="size-4"
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-medium">
                                                {request.offering.subjectCode} ·{' '}
                                                {request.offering.subjectName}
                                            </span>
                                            <span className="text-muted-foreground mt-0.5 block text-sm">
                                                Session {request.offering.session}{' '}
                                                {request.offering.year}
                                            </span>
                                        </span>
                                        <Badge variant="secondary">Pending</Badge>
                                    </li>
                                ))}
                            </ul>

                            {selectedRole &&
                                selectedRole.scopes.length === 0 &&
                                selectedRole.pendingRequests.length === 0 && (
                                    <div className="border-border/70 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
                                        <div className="bg-brand-teal/10 text-brand-teal mb-3 flex size-11 items-center justify-center rounded-lg">
                                            <HugeiconsIcon
                                                icon={BookOpen01Icon}
                                                strokeWidth={2}
                                                className="size-5"
                                            />
                                        </div>
                                        <p className="text-sm font-medium">No subject access yet</p>
                                        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                                            Request an offering to give this role its first scope.
                                        </p>
                                    </div>
                                )}
                        </>
                    )}
                </div>
            </section>
        </main>
    );
}
