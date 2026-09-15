import Link from 'next/link';
import { ArrowRight01Icon, BookOpen01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { formatDate, termLabel } from '@/components/navigation/learning/format';
import { LearningPageHeader } from '@/components/navigation/learning/page-header';
import {
    OfferingFilters,
    type OfferingStatusFilter,
} from '@/components/navigation/learning/offering-filters';
import { termStatus, type LearningAccess, type TermStatus } from '@/components/navigation/learning/policy';
import type { LearningOfferingSummary } from '@/components/navigation/learning/types';
import { Badge } from '@/components/ui/badge';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import {
    learningHref,
    listLearningOfferings,
    requireLearningPageAccess,
} from '@/components/navigation/learning/server';

export const dynamic = 'force-dynamic';

const STATUS_ORDER: TermStatus[] = ['current', 'upcoming', 'past'];
const STATUS_FILTERS = new Set<OfferingStatusFilter>(['all', ...STATUS_ORDER]);
const STATUS_COPY: Record<TermStatus, { title: string; description: string }> = {
    current: {
        title: 'Current study',
        description: 'Offerings whose teaching period is underway.',
    },
    upcoming: {
        title: 'Upcoming study',
        description: 'Offerings scheduled to begin later.',
    },
    past: {
        title: 'Past study',
        description: 'Offerings whose final study period has ended.',
    },
};

export default async function MySubjectsPage({
    searchParams,
}: PageProps<'/navigation/subjects'>) {
    const query = await searchParams;
    const { access } = await requireLearningPageAccess(query, PERMISSION_CODE.OFFERING_VIEW);
    const now = new Date();
    const offerings = await listLearningOfferings(access, now);
    const rawQuery = Array.isArray(query.q) ? query.q[0] : query.q;
    const normalizedQuery = rawQuery?.trim().toLocaleLowerCase() ?? '';
    const rawStatus = Array.isArray(query.status) ? query.status[0] : query.status;
    const status: OfferingStatusFilter = STATUS_FILTERS.has(rawStatus as OfferingStatusFilter)
        ? (rawStatus as OfferingStatusFilter)
        : 'all';
    const visibleOfferings = offerings.filter((offering) => {
        const offeringStatus = termStatus(
            { year: offering.term.year, periods: offering.term.periods },
            now,
        );
        const matchesStatus = status === 'all' || offeringStatus === status;
        const haystack = `${offering.subject.code} ${offering.subject.name}`.toLocaleLowerCase();
        return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
    });

    const grouped = Map.groupBy(visibleOfferings, (offering) =>
        termStatus(
            {
                year: offering.term.year,
                periods: offering.term.periods,
            },
            now,
        ),
    );

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <LearningPageHeader
                title="My subjects"
                description={`Subjects available to ${access.role.roleName} at ${access.institution.name}. Access follows this role's institution or offering scope.`}
                aside={
                    <div className="text-muted-foreground text-right text-sm">
                        <span className="text-foreground block font-medium">{offerings.length}</span>
                        accessible offering{offerings.length === 1 ? '' : 's'}
                    </div>
                }
            />

            {offerings.length > 0 && (
                <OfferingFilters status={status} resultCount={visibleOfferings.length} />
            )}

            {offerings.length === 0 ? (
                <section className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
                    <span className="bg-brand-teal/10 text-brand-teal flex size-11 items-center justify-center rounded-lg">
                        <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} className="size-5" />
                    </span>
                    <h2 className="font-heading mt-4 text-lg font-semibold">No subjects in scope</h2>
                    <p className="text-muted-foreground mt-1 max-w-md text-sm leading-6">
                        This role is active, but it is not connected to an offering yet. Request
                        subject access or switch to another role.
                    </p>
                    <Link
                        href={learningHref('/navigation/subject-access', access)}
                        className="text-primary mt-4 text-sm font-medium hover:underline"
                    >
                        Open Subject Access
                    </Link>
                </section>
            ) : visibleOfferings.length === 0 ? (
                <section className="flex min-h-52 flex-col items-center justify-center border-y px-6 text-center">
                    <h2 className="font-heading text-lg font-semibold">No matching subjects</h2>
                    <p className="text-muted-foreground mt-1 max-w-md text-sm leading-6">
                        Try another subject code, name, or study-period filter.
                    </p>
                </section>
            ) : (
                <div className="space-y-9">
                    {STATUS_ORDER.map((status) => {
                        const statusOfferings = grouped.get(status) ?? [];
                        if (statusOfferings.length === 0) return null;
                        return (
                            <OfferingStatusSection
                                key={status}
                                status={status}
                                offerings={statusOfferings}
                                access={access}
                            />
                        );
                    })}
                </div>
            )}
        </main>
    );
}

function OfferingStatusSection({
    status,
    offerings,
    access,
}: {
    status: TermStatus;
    offerings: LearningOfferingSummary[];
    access: LearningAccess;
}) {
    const terms = Map.groupBy(offerings, (offering) => offering.term.id);
    return (
        <section aria-labelledby={`${status}-heading`}>
            <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                    <h2 id={`${status}-heading`} className="font-heading text-lg font-semibold">
                        {STATUS_COPY[status].title}
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                        {STATUS_COPY[status].description}
                    </p>
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">
                    {offerings.length} offering{offerings.length === 1 ? '' : 's'}
                </span>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
                {[...terms.values()].map((termOfferings, termIndex) => {
                    const term = termOfferings[0].term;
                    const starts = term.periods.map((period) => period.startAt).sort();
                    const ends = term.periods.map((period) => period.endAt).sort();
                    return (
                        <div key={term.id} className={termIndex > 0 ? 'border-t' : undefined}>
                            <div className="bg-muted/35 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 sm:px-5">
                                <h3 className="text-sm font-semibold">{termLabel(term)}</h3>
                                {starts[0] && ends.at(-1) && (
                                    <span className="text-muted-foreground text-xs tabular-nums">
                                        {formatDate(starts[0])} – {formatDate(ends.at(-1)!)}
                                    </span>
                                )}
                            </div>
                            <ul className="divide-y" aria-label={termLabel(term)}>
                                {termOfferings.map((offering) => (
                                    <li key={offering.id}>
                                        <Link
                                            href={learningHref(
                                                `/navigation/subjects/${offering.id}`,
                                                access,
                                                offering.id,
                                            )}
                                            className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/35 sm:px-5"
                                        >
                                            <span className="text-primary w-24 shrink-0 font-semibold tracking-wide">
                                                {offering.subject.code}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">
                                                    {offering.subject.name}
                                                </span>
                                                {offering.publishedAssessmentCount !== null && (
                                                    <span className="text-muted-foreground mt-0.5 block text-xs">
                                                        {offering.publishedAssessmentCount} published assessment
                                                        {offering.publishedAssessmentCount === 1 ? '' : 's'}
                                                    </span>
                                                )}
                                            </span>
                                            {status !== 'current' && (
                                                <Badge variant="outline" className="hidden sm:inline-flex">
                                                    {status === 'past' ? 'Past' : 'Upcoming'}
                                                </Badge>
                                            )}
                                            <HugeiconsIcon
                                                icon={ArrowRight01Icon}
                                                strokeWidth={2}
                                                className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
                                            />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
