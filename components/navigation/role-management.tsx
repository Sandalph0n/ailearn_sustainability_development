'use client';

import { useMemo, useState } from 'react';
import {
    Add01Icon,
    ArrowLeft01Icon,
    BookOpen01Icon,
    Shield01Icon,
    Tick02Icon,
    UniversityIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import {
    RoleRequestForm,
    type InstitutionRequestOption,
} from '@/components/navigation/role-request-form';
import { Button } from '@/components/ui/button';
import type { ContextOption } from '@/lib/context/context-params';

type AssignedRole = {
    assignmentId: string;
    institution: ContextOption['institution'];
    role: ContextOption['role'];
    offerings: NonNullable<ContextOption['offering']>[];
};

function distinctAssignments(contexts: ContextOption[]): AssignedRole[] {
    const assignments = new Map<string, AssignedRole>();

    for (const context of contexts) {
        const existing = assignments.get(context.assignmentId);
        if (existing) {
            if (
                context.offering &&
                !existing.offerings.some((offering) => offering.id === context.offering?.id)
            ) {
                existing.offerings.push(context.offering);
            }
            continue;
        }

        assignments.set(context.assignmentId, {
            assignmentId: context.assignmentId,
            institution: context.institution,
            role: context.role,
            offerings: context.offering ? [context.offering] : [],
        });
    }

    return Array.from(assignments.values());
}

export function RoleManagement({
    contexts,
    institutions,
}: {
    contexts: ContextOption[];
    institutions: InstitutionRequestOption[];
}) {
    const assignments = useMemo(() => distinctAssignments(contexts), [contexts]);
    const hasRoles = assignments.length > 0;
    const institutionOptions = useMemo(() => {
        const unique = new Map<string, ContextOption['institution']>();
        for (const assignment of assignments) {
            unique.set(assignment.institution.id, assignment.institution);
        }
        return Array.from(unique.values());
    }, [assignments]);

    const [requesting, setRequesting] = useState(!hasRoles);
    const [institutionId, setInstitutionId] = useState(
        institutionOptions.at(0)?.id ?? null,
    );
    const initialRoles = assignments.filter(
        (assignment) => assignment.institution.id === institutionOptions.at(0)?.id,
    );
    const [assignmentId, setAssignmentId] = useState(
        initialRoles.at(0)?.assignmentId ?? null,
    );

    function chooseInstitution(nextInstitutionId: string) {
        setInstitutionId(nextInstitutionId);
        const firstRole = assignments.find(
            (assignment) => assignment.institution.id === nextInstitutionId,
        );
        setAssignmentId(firstRole?.assignmentId ?? null);
    }

    if (requesting) {
        return (
            <RoleRequestPanel
                institutions={institutions}
                canGoBack={hasRoles}
                onBack={() => setRequesting(false)}
            />
        );
    }

    const selectedInstitution = institutionOptions.find(
        (institution) => institution.id === institutionId,
    );
    const visibleRoles = assignments.filter(
        (assignment) => assignment.institution.id === institutionId,
    );

    return (
        <main className="mx-auto w-full max-w-6xl py-8 sm:py-12">
            <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-brand-teal mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
                        Account access
                    </p>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                        Role management
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                        Review the institutions you belong to and the active roles you hold at each
                        one.
                    </p>
                </div>

                <Button type="button" size="lg" onClick={() => setRequesting(true)}>
                    <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                    Request another role
                </Button>
            </header>

            <section className="bg-card grid min-h-120 overflow-hidden rounded-xl border shadow-sm lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)]">
                <div className="bg-muted/25 border-b p-5 lg:border-r lg:border-b-0 sm:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-heading font-semibold">Institution</h2>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                                Choose where you are working.
                            </p>
                        </div>
                        <span className="bg-background text-muted-foreground rounded-md border px-2 py-1 text-xs font-medium">
                            {institutionOptions.length}
                        </span>
                    </div>

                    <ul className="space-y-2" aria-label="Your institutions">
                        {institutionOptions.map((institution) => {
                            const selected = institution.id === institutionId;
                            const roleCount = assignments.filter(
                                (assignment) => assignment.institution.id === institution.id,
                            ).length;

                            return (
                                <li key={institution.id}>
                                    <button
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => chooseInstitution(institution.id)}
                                        className={
                                            'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ' +
                                            (selected
                                                ? 'border-brand-teal/50 bg-brand-teal/8'
                                                : 'bg-card hover:border-brand-teal/30 hover:bg-muted/40')
                                        }
                                    >
                                        <span
                                            className={
                                                'flex size-9 shrink-0 items-center justify-center rounded-md ' +
                                                (selected
                                                    ? 'bg-brand-teal/12 text-brand-teal'
                                                    : 'bg-muted text-muted-foreground')
                                            }
                                        >
                                            <HugeiconsIcon
                                                icon={UniversityIcon}
                                                strokeWidth={2}
                                                className="size-4"
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">
                                                {institution.name}
                                            </span>
                                            <span className="text-muted-foreground block text-xs">
                                                {roleCount} {roleCount === 1 ? 'role' : 'roles'}
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
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-heading font-semibold">
                                Roles at {selectedInstitution?.name}
                            </h2>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                                Select a role to inspect its assigned scope.
                            </p>
                        </div>
                        <span className="text-muted-foreground text-xs font-medium">
                            {visibleRoles.length} {visibleRoles.length === 1 ? 'role' : 'roles'}
                        </span>
                    </div>

                    <ul className="space-y-3" aria-label="Your roles">
                        {visibleRoles.map((assignment) => {
                            const selected = assignment.assignmentId === assignmentId;
                            const isInstitutionRole = assignment.role.scopeType === 'INSTITUTION';

                            return (
                                <li key={assignment.assignmentId}>
                                    <button
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => setAssignmentId(assignment.assignmentId)}
                                        className={
                                            'group flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors ' +
                                            (selected
                                                ? 'border-brand-teal/50 ring-brand-teal/15 bg-brand-teal/5 ring-2'
                                                : 'hover:border-brand-teal/30 hover:bg-muted/25')
                                        }
                                    >
                                        <span
                                            className={
                                                'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md ' +
                                                (selected
                                                    ? 'bg-brand-teal/12 text-brand-teal'
                                                    : 'bg-muted text-muted-foreground')
                                            }
                                        >
                                            <HugeiconsIcon
                                                icon={
                                                    isInstitutionRole
                                                        ? Shield01Icon
                                                        : BookOpen01Icon
                                                }
                                                strokeWidth={2}
                                                className="size-4"
                                            />
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-2">
                                                <span className="font-heading font-semibold">
                                                    {assignment.role.roleName}
                                                </span>
                                                <span className="text-muted-foreground rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase">
                                                    {isInstitutionRole
                                                        ? 'Institution'
                                                        : 'Offering'}
                                                </span>
                                            </span>

                                            <span className="text-muted-foreground mt-1.5 block text-sm leading-5">
                                                {isInstitutionRole
                                                    ? 'Access applies across this institution.'
                                                    : assignment.offerings.length === 0
                                                      ? 'This role has not been connected to an offering yet.'
                                                      : `Scoped to ${assignment.offerings.length} ${assignment.offerings.length === 1 ? 'offering' : 'offerings'}.`}
                                            </span>

                                            {!isInstitutionRole &&
                                                assignment.offerings.length > 0 && (
                                                    <span className="mt-3 flex flex-wrap gap-1.5">
                                                        {assignment.offerings.map((offering) => (
                                                            <span
                                                                key={offering.id}
                                                                className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs"
                                                            >
                                                                {offering.subjectCode} · S
                                                                {offering.session} {offering.year}
                                                            </span>
                                                        ))}
                                                    </span>
                                                )}
                                        </span>

                                        <span
                                            className={
                                                'mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border ' +
                                                (selected
                                                    ? 'border-brand-teal bg-brand-teal text-white'
                                                    : 'border-border')
                                            }
                                        >
                                            {selected && (
                                                <HugeiconsIcon
                                                    icon={Tick02Icon}
                                                    strokeWidth={2.5}
                                                    className="size-3"
                                                />
                                            )}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </section>
        </main>
    );
}

function RoleRequestPanel({
    institutions,
    canGoBack,
    onBack,
}: {
    institutions: InstitutionRequestOption[];
    canGoBack: boolean;
    onBack: () => void;
}) {
    return (
        <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center py-10 sm:py-16">
            <section className="bg-card grid min-h-144 w-full overflow-hidden rounded-xl border shadow-sm lg:grid-cols-[minmax(0,0.8fr)_minmax(26rem,1.2fr)]">
                <div className="bg-muted/30 flex flex-col justify-center border-b p-8 sm:p-10 lg:border-r lg:border-b-0">
                    {canGoBack && (
                        <Button
                            type="button"
                            variant="ghost"
                            className="mb-8 w-fit -translate-x-3"
                            onClick={onBack}
                        >
                            <HugeiconsIcon
                                icon={ArrowLeft01Icon}
                                strokeWidth={2}
                                data-icon="inline-start"
                            />
                            Back to your roles
                        </Button>
                    )}

                    <div className="bg-brand-teal/10 text-brand-teal mb-7 flex size-11 items-center justify-center rounded-lg">
                        <HugeiconsIcon icon={Shield01Icon} strokeWidth={2} className="size-5" />
                    </div>

                    <p className="text-brand-teal mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
                        Account access
                    </p>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                        {canGoBack ? 'Request another role' : 'You do not have active access yet'}
                    </h1>
                    <p className="text-muted-foreground mt-3 max-w-md text-sm leading-6">
                        Join the institution where you study or work. Your requested role determines
                        which subjects, offerings and tools you can access. Offering roles may be
                        approved before an administrator connects them to specific offerings.
                    </p>

                    <div className="border-border/70 mt-8 border-t pt-6">
                        <p className="text-sm font-medium">What happens next</p>
                        <ol className="text-muted-foreground mt-4 space-y-3 text-sm">
                            <li className="flex items-center gap-3">
                                <span className="border-brand-teal/30 text-brand-teal flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                                    1
                                </span>
                                Choose an institution and one of its available roles.
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="border-border flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                                    2
                                </span>
                                An institution administrator reviews your request.
                            </li>
                        </ol>
                    </div>
                </div>

                <RoleRequestForm institutions={institutions} />
            </section>
        </main>
    );
}
