import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert02Icon, ArrowRight01Icon, UserMultipleIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { StartAttemptButton } from '@/components/navigation/learning/attempt-actions';
import { dueLabel, formatDateTime, termLabel } from '@/components/navigation/learning/format';
import { LearningPageHeader } from '@/components/navigation/learning/page-header';
import { canStartAttempts } from '@/components/navigation/learning/policy';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import {
    getPublishedAssessment,
    learningContextParams,
    learningHref,
    listOwnAttempts,
    requireLearningPageAccess,
} from '@/components/navigation/learning/server';

export const dynamic = 'force-dynamic';

export default async function AssessmentLearningPage({
    params,
    searchParams,
}: PageProps<'/navigation/assessments/[assessmentId]'>) {
    const [{ assessmentId }, query] = await Promise.all([params, searchParams]);
    const { userId, access } = await requireLearningPageAccess(
        query,
        PERMISSION_CODE.OFFERING_VIEW,
    );
    const now = new Date();
    const assessment = await getPublishedAssessment(access, assessmentId, now);
    if (!assessment) notFound();

    const attempts = await listOwnAttempts(userId, access, assessmentId, now);
    const offeringId = assessment.offering.id;
    const contextQuery = learningContextParams(access, offeringId).toString();
    const mayStart = canStartAttempts(access) && !assessment.isGroup;
    const mayReviewStudentAttempts = hasPermission(
        access.permissions,
        PERMISSION_CODE.ATTEMPT_VIEW_ALL,
    );
    const studentAttemptsHref = `/navigation/institution/offerings/${offeringId}/assessments/${assessment.id}/attempts?${contextQuery}`;

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <LearningPageHeader
                eyebrow={assessment.offering.subject.code}
                title={assessment.name}
                description={`${assessment.offering.subject.name} · ${termLabel(assessment.offering.term)}`}
                back={{
                    href: learningHref(
                        `/navigation/subjects/${offeringId}`,
                        access,
                        offeringId,
                    ),
                    label: assessment.offering.subject.code,
                }}
                aside={
                    <div className="flex items-center gap-2">
                        {assessment.hurdle && <Badge variant="outline">Hurdle</Badge>}
                        {assessment.isGroup && <Badge variant="secondary">Group</Badge>}
                        <Badge>{assessment.weight}%</Badge>
                    </div>
                }
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
                <div className="space-y-6">
                    <section className="rounded-xl border bg-card p-5 sm:p-6">
                        <h2 className="font-heading text-lg font-semibold">Assessment brief</h2>
                        <p className="text-muted-foreground mt-3 whitespace-pre-line text-sm leading-7">
                            {assessment.description || 'No additional instructions have been provided.'}
                        </p>
                    </section>

                    {assessment.isGroup && (
                        <section className="border-brand-amber/35 bg-brand-amber/5 flex gap-3 rounded-xl border p-5">
                            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="text-brand-amber mt-0.5 size-5 shrink-0" />
                            <div>
                                <h2 className="font-medium">Group attempts are not available yet</h2>
                                <p className="text-muted-foreground mt-1 text-sm leading-6">
                                    This assessment is marked as group work. Starting an individual
                                    attempt is disabled until group membership and collaboration are supported.
                                </p>
                            </div>
                        </section>
                    )}
                </div>

                <aside className="space-y-6">
                    <section className="rounded-xl border bg-card p-5">
                        <h2 className="font-heading text-base font-semibold">Schedule</h2>
                        <dl className="mt-4 space-y-3 text-sm">
                            <div className="flex items-start justify-between gap-4">
                                <dt className="text-muted-foreground">Published</dt>
                                <dd className="text-right tabular-nums">{formatDateTime(assessment.publishAt)}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-4 border-t pt-3">
                                <dt className="text-muted-foreground">Due</dt>
                                <dd className="max-w-56 text-right">{dueLabel(assessment.dueAt, assessment.expectedDue)}</dd>
                            </div>
                            {assessment.dueAt && assessment.expectedDue && (
                                <div className="flex items-start justify-between gap-4 border-t pt-3">
                                    <dt className="text-muted-foreground">Guidance</dt>
                                    <dd className="max-w-56 text-right">{assessment.expectedDue}</dd>
                                </div>
                            )}
                        </dl>
                    </section>

                    <section aria-labelledby="attempts-heading">
                        <div className="mb-3 flex items-end justify-between gap-3">
                            <div>
                                <h2 id="attempts-heading" className="font-heading text-lg font-semibold">
                                    {attempts === null && mayReviewStudentAttempts
                                        ? 'Student attempts'
                                        : 'Your attempts'}
                                </h2>
                                <p className="text-muted-foreground mt-0.5 text-sm">
                                    {attempts === null && mayReviewStudentAttempts
                                        ? 'Inspect work submitted within this offering.'
                                        : 'Attempts are currently unlimited.'}
                                </p>
                            </div>
                            {mayStart && (
                                <StartAttemptButton
                                    endpoint={`/api/me/attempts?${contextQuery}`}
                                    assessmentId={assessment.id}
                                    attemptBasePath={`/navigation/assessments/${assessment.id}/attempts`}
                                    contextQuery={contextQuery}
                                />
                            )}
                        </div>

                        {attempts === null && mayReviewStudentAttempts ? (
                            <div className="rounded-xl border bg-card p-5">
                                <p className="text-sm font-medium">
                                    This role reviews student work rather than starting its own attempt.
                                </p>
                                <p className="text-muted-foreground mt-1 text-sm leading-6">
                                    Continue to the offering workspace to see students, attempt status,
                                    and recorded tool sessions.
                                </p>
                                <Link
                                    href={studentAttemptsHref}
                                    className={cn(buttonVariants(), 'mt-4')}
                                >
                                    <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} />
                                    Review student attempts
                                </Link>
                            </div>
                        ) : attempts === null ? (
                            <div className="rounded-xl border border-dashed p-5 text-sm">
                                <p className="font-medium">Attempt history is unavailable</p>
                                <p className="text-muted-foreground mt-1">This role cannot view your attempts.</p>
                            </div>
                        ) : attempts.length === 0 ? (
                            <div className="rounded-xl border border-dashed p-5 text-center text-sm">
                                <p className="font-medium">No attempts yet</p>
                                <p className="text-muted-foreground mt-1">
                                    {assessment.isGroup
                                        ? 'Group attempts will become available with group membership support.'
                                        : mayStart
                                          ? 'Start when you are ready.'
                                          : 'This role cannot start an attempt.'}
                                </p>
                            </div>
                        ) : (
                            <ol className="divide-y overflow-hidden rounded-xl border bg-card">
                                {attempts.map((attempt, index) => (
                                    <li key={attempt.id}>
                                        <Link
                                            href={`/navigation/assessments/${assessment.id}/attempts/${attempt.id}?${contextQuery}`}
                                            className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/35"
                                        >
                                            <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums">
                                                {attempts.length - index}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-medium">
                                                    {attempt.submitAt ? 'Submitted attempt' : 'Attempt in progress'}
                                                </span>
                                                <span className="text-muted-foreground mt-0.5 block text-xs tabular-nums">
                                                    Started {formatDateTime(attempt.startAt)}
                                                </span>
                                            </span>
                                            <Badge variant={attempt.submitAt ? 'secondary' : 'outline'}>
                                                {attempt.submitAt ? 'Submitted' : 'Resume'}
                                            </Badge>
                                            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground size-4" />
                                        </Link>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </aside>
            </div>
        </main>
    );
}
