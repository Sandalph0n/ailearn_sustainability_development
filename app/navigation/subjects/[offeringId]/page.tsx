import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight01Icon, BookOpen01Icon, Clock01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { dueLabel, termLabel } from '@/components/navigation/learning/format';
import { LearningPageHeader } from '@/components/navigation/learning/page-header';
import { Badge } from '@/components/ui/badge';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import {
    getLearningOffering,
    learningHref,
    requireLearningPageAccess,
} from '@/components/navigation/learning/server';

export const dynamic = 'force-dynamic';

export default async function OfferingLearningPage({
    params,
    searchParams,
}: PageProps<'/navigation/subjects/[offeringId]'>) {
    const [{ offeringId }, query] = await Promise.all([params, searchParams]);
    const { userId, access } = await requireLearningPageAccess(
        query,
        PERMISSION_CODE.OFFERING_VIEW,
    );
    const offering = await getLearningOffering(userId, access, offeringId, new Date());
    if (!offering) notFound();

    const subjectsHref = learningHref('/navigation/subjects', access, offering.id);

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <LearningPageHeader
                eyebrow={offering.subject.code}
                title={offering.subject.name}
                description={`${termLabel(offering.term)} · ${offering.institution.name}`}
                back={{ href: subjectsHref, label: 'My subjects' }}
                aside={<Badge variant="outline">{access.role.roleName}</Badge>}
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(28rem,1.28fr)]">
                <section className="rounded-xl border bg-card p-5 sm:p-6">
                    <div className="bg-brand-teal/10 text-brand-teal flex size-10 items-center justify-center rounded-lg">
                        <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} className="size-5" />
                    </div>
                    <h2 className="font-heading mt-4 text-lg font-semibold">Subject overview</h2>
                    <p className="text-muted-foreground mt-2 whitespace-pre-line text-sm leading-6">
                        {offering.subject.description || 'No subject description has been provided.'}
                    </p>
                </section>

                <section aria-labelledby="published-assessments-heading">
                    <div className="mb-3">
                        <h2 id="published-assessments-heading" className="font-heading text-lg font-semibold">
                            Published assessments
                        </h2>
                        <p className="text-muted-foreground mt-0.5 text-sm">
                            Only assessments released by the teaching team appear here.
                        </p>
                    </div>

                    {offering.assessments === null ? (
                        <div className="rounded-xl border border-dashed p-6 text-sm">
                            <p className="font-medium">Assessment access is not available</p>
                            <p className="text-muted-foreground mt-1">
                                This role may view the offering, but it cannot view published assessments.
                            </p>
                        </div>
                    ) : offering.assessments.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-6 text-center">
                            <p className="text-sm font-medium">Nothing published yet</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Draft assessments remain private until their publish time.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                            {offering.assessments.map((assessment) => (
                                <li key={assessment.id}>
                                    <Link
                                        href={learningHref(
                                            `/navigation/assessments/${assessment.id}`,
                                            access,
                                            offering.id,
                                        )}
                                        className="group flex gap-4 px-4 py-4 transition-colors hover:bg-muted/35 sm:px-5"
                                    >
                                        <span className="bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md">
                                            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium">{assessment.name}</span>
                                                {assessment.hurdle && <Badge variant="outline">Hurdle</Badge>}
                                                {assessment.isGroup && <Badge variant="secondary">Group</Badge>}
                                            </span>
                                            <span className="text-muted-foreground mt-1 block text-sm">
                                                Due {dueLabel(assessment.dueAt, assessment.expectedDue)}
                                            </span>
                                            {assessment.ownAttemptCount !== null && (
                                                <span className="text-muted-foreground mt-0.5 block text-xs">
                                                    {assessment.ownAttemptCount} attempt
                                                    {assessment.ownAttemptCount === 1 ? '' : 's'}
                                                </span>
                                            )}
                                        </span>
                                        <span className="flex shrink-0 items-center gap-3">
                                            <span className="text-sm font-medium tabular-nums">{assessment.weight}%</span>
                                            <HugeiconsIcon
                                                icon={ArrowRight01Icon}
                                                strokeWidth={2}
                                                className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
                                            />
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </main>
    );
}
