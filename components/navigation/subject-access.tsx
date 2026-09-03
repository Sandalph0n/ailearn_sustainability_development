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
    Key01Icon,
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
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
}: {
    roles: SubjectAccessRole[];
    offerings: SubjectAccessOffering[];
}) {
    const router = useRouter();
    const [adding, setAdding] = useState(false);
    const [assignmentId, setAssignmentId] = useState(roles.at(0)?.assignmentId ?? null);
    const [method, setMethod] = useState<'REQUEST' | 'CODE'>('REQUEST');
    const [offering, setOffering] = useState<SubjectAccessOffering | null>(null);
    const [code, setCode] = useState('');
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
        setOffering(null);
        setError(null);
    }

    async function submit() {
        if (!assignmentId || submitting) return;
        if (method === 'REQUEST' && !offering) return;
        if (method === 'CODE' && code.trim().length === 0) return;

        setSubmitting(true);
        setError(null);

        const endpoint = method === 'REQUEST' ? '/api/scope-requests' : '/api/scope-codes/redeem';
        const payload =
            method === 'REQUEST'
                ? { roleAssignmentId: assignmentId, offeringId: offering?.id }
                : { roleAssignmentId: assignmentId, codeId: code.trim() };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body: unknown = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = responseError(
                    body,
                    method === 'REQUEST'
                        ? 'Could not send the subject access request.'
                        : 'Could not use that access code.',
                );
                setError(message);
                toast.error(message);
                return;
            }

            toast.success(
                method === 'REQUEST'
                    ? 'Subject access request sent for review.'
                    : 'Subject access added.',
            );
            setOffering(null);
            setCode('');
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

    if (adding) {
        return (
            <main className="mx-auto w-full max-w-5xl py-8 sm:py-12">
                <Button
                    type="button"
                    variant="ghost"
                    className="mb-6 -translate-x-3"
                    onClick={() => setAdding(false)}
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} data-icon="inline-start" />
                    Back to subject access
                </Button>

                <header className="mb-7">
                    <p className="text-brand-teal mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
                        Add scope
                    </p>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                        Add subject access
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                        Choose which of your offering roles should apply, then request access or use
                        a code supplied by the institution.
                    </p>
                </header>

                <section className="bg-card grid overflow-hidden rounded-xl border shadow-sm lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
                    <div className="bg-muted/25 border-b p-6 lg:border-r lg:border-b-0 sm:p-8">
                        <h2 className="font-heading font-semibold">Access role</h2>
                        <p className="text-muted-foreground mt-1 text-sm leading-5">
                            The subject scope will be attached to this role assignment.
                        </p>

                        <div className="mt-5 space-y-2">
                            <label htmlFor="scope-role" className="text-sm font-medium">
                                Institution and role
                            </label>
                            <Select
                                items={Object.fromEntries(
                                    roles.map((role) => [
                                        role.assignmentId,
                                        `${role.institution.name} · ${role.roleName}`,
                                    ]),
                                )}
                                value={assignmentId}
                                onValueChange={chooseRole}
                            >
                                <SelectTrigger id="scope-role" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((role) => (
                                        <SelectItem key={role.assignmentId} value={role.assignmentId}>
                                            <span className="flex flex-col">
                                                <span>{role.roleName}</span>
                                                <span className="text-muted-foreground text-xs">
                                                    {role.institution.name}
                                                </span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8">
                        <div className="grid grid-cols-2 gap-2 rounded-lg border p-1">
                            <button
                                type="button"
                                aria-pressed={method === 'REQUEST'}
                                onClick={() => {
                                    setMethod('REQUEST');
                                    setError(null);
                                }}
                                className={
                                    'rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
                                    (method === 'REQUEST'
                                        ? 'bg-brand-teal text-white'
                                        : 'text-muted-foreground hover:bg-muted')
                                }
                            >
                                Request access
                            </button>
                            <button
                                type="button"
                                aria-pressed={method === 'CODE'}
                                onClick={() => {
                                    setMethod('CODE');
                                    setError(null);
                                }}
                                className={
                                    'rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
                                    (method === 'CODE'
                                        ? 'bg-brand-teal text-white'
                                        : 'text-muted-foreground hover:bg-muted')
                                }
                            >
                                Use access code
                            </button>
                        </div>

                        {method === 'REQUEST' ? (
                            <div className="mt-6 space-y-2">
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
                                    Access starts only after an administrator approves the request.
                                </p>
                            </div>
                        ) : (
                            <div className="mt-6 space-y-2">
                                <label htmlFor="access-code" className="text-sm font-medium">
                                    Access code
                                </label>
                                <Input
                                    id="access-code"
                                    value={code}
                                    onChange={(event) => setCode(event.target.value)}
                                    placeholder="00000000-0000-0000-0000-000000000000"
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="font-mono"
                                />
                                <p className="text-muted-foreground text-xs">
                                    A valid code grants access immediately and can only be used once.
                                </p>
                            </div>
                        )}

                        {error && (
                            <p
                                role="alert"
                                className="border-destructive/30 bg-destructive/10 text-destructive mt-5 rounded-lg border px-3 py-2 text-sm"
                            >
                                {error}
                            </p>
                        )}

                        <Button
                            type="button"
                            size="lg"
                            className="mt-7"
                            disabled={
                                submitting ||
                                !assignmentId ||
                                (method === 'REQUEST' ? !offering : code.trim().length === 0)
                            }
                            onClick={() => void submit()}
                        >
                            {submitting ? (
                                <Spinner />
                            ) : (
                                <HugeiconsIcon
                                    icon={method === 'REQUEST' ? ArrowRight01Icon : Key01Icon}
                                    strokeWidth={2}
                                    data-icon="inline-start"
                                />
                            )}
                            {method === 'REQUEST' ? 'Send request' : 'Use code'}
                        </Button>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="mx-auto w-full max-w-6xl py-8 sm:py-12">
            <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-brand-teal mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
                        Offering scopes
                    </p>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                        Subject access
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                        See where each of your roles applies, request another subject, or join with
                        an access code.
                    </p>
                </div>
                <Button type="button" size="lg" onClick={() => setAdding(true)}>
                    <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                    Add subject access
                </Button>
            </header>

            <section className="bg-card grid min-h-120 overflow-hidden rounded-xl border shadow-sm lg:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.25fr)]">
                <div className="bg-muted/25 border-b p-5 lg:border-r lg:border-b-0 sm:p-6">
                    <h2 className="font-heading font-semibold">Institution and role</h2>
                    <p className="text-muted-foreground mt-0.5 mb-4 text-xs">
                        Choose the role whose subject access you want to inspect.
                    </p>
                    <ul className="space-y-2" aria-label="Offering roles">
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
                    <div className="mb-4">
                        <h2 className="font-heading font-semibold">
                            Access as {selectedRole?.roleName}
                        </h2>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                            {selectedRole?.institution.name}
                        </p>
                    </div>

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
                                        {scope.offering.subjectCode} · {scope.offering.subjectName}
                                    </span>
                                    <span className="text-muted-foreground mt-0.5 block text-sm">
                                        Session {scope.offering.session} {scope.offering.year}
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
                                    Request an offering or use an access code to give this role a
                                    scope.
                                </p>
                            </div>
                        )}
                </div>
            </section>
        </main>
    );
}
