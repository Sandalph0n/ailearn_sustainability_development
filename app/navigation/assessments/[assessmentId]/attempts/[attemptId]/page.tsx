import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckmarkCircle02Icon, Clock01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { SubmitAttemptButton } from '@/components/navigation/learning/attempt-actions';
import { dueLabel, formatDateTime } from '@/components/navigation/learning/format';
import { LearningPageHeader } from '@/components/navigation/learning/page-header';
import { canStartAttempts } from '@/components/navigation/learning/policy';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import {
    getOwnAttempt,
    learningContextParams,
    learningHref,
    requireLearningPageAccess,
} from '@/components/navigation/learning/server';

export const dynamic = 'force-dynamic';

export default async function AttemptPage({
    params,
    searchParams,
}: PageProps<'/navigation/assessments/[assessmentId]/attempts/[attemptId]'>) {
    const [{ assessmentId, attemptId }, query] = await Promise.all([params, searchParams]);
    const { userId, access } = await requireLearningPageAccess(
        query,
        PERMISSION_CODE.OFFERING_VIEW,
    );
    const result = await getOwnAttempt(userId, access, attemptId, new Date());
    if (!result || result.assessment.id !== assessmentId) notFound();

    const { attempt, assessment } = result;
    const contextQuery = learningContextParams(access, assessment.offering.id).toString();
    const submitted = attempt.submitAt !== null;

    return (
        <main className="mx-auto w-full max-w-6xl py-7">
            <LearningPageHeader
                eyebrow={assessment.offering.subject.code}
                title={assessment.name}
                description={submitted ? 'Submitted attempt' : 'Attempt in progress'}
                back={{
                    href: learningHref(
                        `/navigation/assessments/${assessment.id}`,
                        access,
                        assessment.offering.id,
                    ),
                    label: 'Assessment details',
                }}
                aside={
                    <Badge variant={submitted ? 'secondary' : 'outline'}>
                        {submitted ? 'Read-only' : 'Active'}
                    </Badge>
                }
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
                <section className="flex min-h-80 flex-col rounded-xl border bg-card p-6">
                    <div className="flex items-center gap-3">
                        <span className="bg-brand-teal/10 text-brand-teal flex size-10 items-center justify-center rounded-lg">
                            <HugeiconsIcon
                                icon={submitted ? CheckmarkCircle02Icon : Clock01Icon}
                                strokeWidth={2}
                                className="size-5"
                            />
                        </span>
                        <div>
                            <h2 className="font-heading text-lg font-semibold">
                                {submitted ? 'Attempt submitted' : 'Assignment workspace ready'}
                            </h2>
                            <p className="text-muted-foreground mt-0.5 text-sm">
                                {submitted
                                    ? `Submitted ${formatDateTime(attempt.submitAt!)}`
                                    : 'Your work is attached to this attempt.'}
                            </p>
                        </div>
                    </div>

                    <div className="border-border/70 mt-6 flex flex-1 items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
                        <div className="max-w-md">
                            <p className="text-sm font-medium">
                                {submitted ? 'This workspace is read-only' : 'Workspace editor is separate from this learning flow'}
                            </p>
                            <p className="text-muted-foreground mt-1 text-sm leading-6">
                                {submitted
                                    ? 'You can review this attempt, but its contents can no longer be changed.'
                                    : 'You can safely return to this attempt. Document editing and learning tools will connect here in their own implementation.'}
                            </p>
                            <Link
                                href={`/navigation/workspaces/${attempt.workspace.id}`}
                                className={buttonVariants({ className: 'mt-5' })}
                            >
                                {submitted ? 'Review workspace' : 'Open workspace'}
                            </Link>
                        </div>
                    </div>
                </section>

                <aside className="space-y-5">
                    <section className="rounded-xl border bg-card p-5">
                        <h2 className="font-heading text-base font-semibold">Attempt details</h2>
                        <dl className="mt-4 space-y-3 text-sm">
                            <div className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">Started</dt>
                                <dd className="text-right tabular-nums">{formatDateTime(attempt.startAt)}</dd>
                            </div>
                            <div className="flex justify-between gap-3 border-t pt-3">
                                <dt className="text-muted-foreground">Due</dt>
                                <dd className="max-w-48 text-right">{dueLabel(assessment.dueAt, assessment.expectedDue)}</dd>
                            </div>
                            <div className="flex justify-between gap-3 border-t pt-3">
                                <dt className="text-muted-foreground">Weight</dt>
                                <dd className="font-medium tabular-nums">{assessment.weight}%</dd>
                            </div>
                        </dl>
                    </section>

                    {!submitted && canStartAttempts(access) && (
                        <section className="rounded-xl border bg-card p-5">
                            <h2 className="font-heading text-base font-semibold">Ready to finish?</h2>
                            <p className="text-muted-foreground mt-1 mb-4 text-sm leading-6">
                                Submission locks this attempt. You can still start a new, separate attempt afterwards.
                            </p>
                            <SubmitAttemptButton endpoint={`/api/me/attempts/${attempt.id}/submit?${contextQuery}`} />
                        </section>
                    )}
                </aside>
            </div>
        </main>
    );
}
