import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';

import { LearningPageHeader } from '@/components/navigation/learning/page-header';
import {
    AttemptReviewWorkspace,
    type ReviewFlag,
    type ReviewMark,
} from '@/components/navigation/marking/attempt-review-workspace';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/db';
import {
    markingContextQuery,
    markingOfferingWhere,
    requireMarkingAccess,
} from '@/lib/marking/access';
import { deriveAttemptFlags } from '@/lib/marking/attempt-flags';

export const dynamic = 'force-dynamic';

const DATE_TIME = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Australia/Sydney',
});

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export default async function MarkingAttemptPage({
    params,
    searchParams,
}: PageProps<'/navigation/marking/attempts/[attemptId]'>) {
    const [{ attemptId }, query] = await Promise.all([params, searchParams]);
    if (!z.uuid().safeParse(attemptId).success) notFound();

    const access = await requireMarkingAccess(query);
    const canOpenAttempt =
        access.capabilities.canViewAttempt ||
        access.capabilities.canReplay ||
        access.capabilities.canMark;
    if (!canOpenAttempt) redirect(`/navigation/marking?${markingContextQuery(access)}`);

    const canViewMarks = access.capabilities.canViewAttempt || access.capabilities.canMark;
    const offeringWhere = markingOfferingWhere(access);
    const attempt = await db.assessmentAttempt.findFirst({
        where: { id: attemptId, assessment: { offering: offeringWhere } },
        select: {
            id: true,
            startAt: true,
            submitAt: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            assessment: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    weight: true,
                    hurdle: true,
                    dueAt: true,
                    expectedDue: true,
                    offering: {
                        select: {
                            id: true,
                            subject: { select: { subjectCode: true, subjectName: true } },
                            term: { select: { year: true, session: true } },
                        },
                    },
                },
            },
            workspace: {
                select: {
                    workSessions: {
                        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
                        select: {
                            id: true,
                            tool: { select: { name: true } },
                            eventBatches: access.capabilities.canReplay
                                ? {
                                      orderBy: { seqStart: 'asc' },
                                      select: {
                                          seqStart: true,
                                          clientAt: true,
                                          receivedAt: true,
                                          events: true,
                                      },
                                  }
                                : false,
                        },
                    },
                },
            },
            result: { select: { markId: true } },
        },
    });
    if (!attempt) notFound();

    const storedMarks = canViewMarks
        ? await db.assessmentAttemptMark.findMany({
              where: {
                  attemptId,
                  OR: [{ status: { not: 'DRAFT' } }, { markedById: access.userId }],
              },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              select: {
                  id: true,
                  score: true,
                  outOf: true,
                  feedback: true,
                  status: true,
                  createdAt: true,
                  submittedAt: true,
                  markedById: true,
                  markedBy: {
                      select: { firstName: true, lastName: true, email: true },
                  },
              },
          })
        : [];

    const studentName =
        [attempt.user.firstName, attempt.user.lastName].filter(Boolean).join(' ') ||
        attempt.user.email;
    const sessions = attempt.workspace?.workSessions ?? [];
    const replaySession = access.capabilities.canReplay
        ? sessions.find((session) => session.eventBatches.length > 0) ?? sessions[0] ?? null
        : null;
    const flags: ReviewFlag[] = access.capabilities.canReplay
        ? deriveAttemptFlags(sessions).map((flag) => ({
              key: flag.key,
              severity: flag.severity,
              label: flag.label,
              detail: flag.detail,
              at: DATE_TIME.format(flag.at),
          }))
        : [];
    const marks: ReviewMark[] = storedMarks.map((mark) => {
        const markerName =
            [mark.markedBy.firstName, mark.markedBy.lastName].filter(Boolean).join(' ') ||
            mark.markedBy.email;
        return {
            id: mark.id,
            markerName,
            markerEmail: mark.markedBy.email,
            score: mark.score?.toString() ?? null,
            outOf: mark.outOf.toString(),
            feedback: mark.feedback,
            status: mark.status,
            createdAt: DATE_TIME.format(mark.createdAt),
            submittedAt: mark.submittedAt ? DATE_TIME.format(mark.submittedAt) : null,
            official: attempt.result?.markId === mark.id,
            own: mark.markedById === access.userId,
        };
    });

    const returnParams = new URLSearchParams(markingContextQuery(access));
    for (const key of ['termId', 'subjectId', 'studentId'] as const) {
        const value = first(query[key]);
        if (value) returnParams.set(key, value);
    }

    return (
        <main className="mx-auto w-full max-w-[92rem] py-7">
            <LearningPageHeader
                eyebrow={`${attempt.assessment.offering.subject.subjectCode} · Attempt review`}
                title={studentName}
                description={`${attempt.assessment.name} · ${attempt.assessment.offering.term.year} Session ${attempt.assessment.offering.term.session}`}
                back={{ href: `/navigation/marking?${returnParams}`, label: 'Marking & Replay' }}
                aside={
                    <div className="flex flex-wrap gap-2">
                        <Badge variant={attempt.submitAt ? 'secondary' : 'outline'}>{attempt.submitAt ? 'Submitted' : 'Active attempt'}</Badge>
                        {attempt.assessment.hurdle && <Badge variant="outline">Hurdle</Badge>}
                        <Badge>{attempt.assessment.weight}%</Badge>
                    </div>
                }
            />

            <section className="mb-5 grid gap-px border bg-border sm:grid-cols-2 xl:grid-cols-4">
                <div className="bg-card px-4 py-3"><p className="text-muted-foreground text-xs">Assessment</p><p className="mt-0.5 text-sm font-medium">{attempt.assessment.name}</p></div>
                <div className="bg-card px-4 py-3"><p className="text-muted-foreground text-xs">Subject</p><p className="mt-0.5 text-sm font-medium">{attempt.assessment.offering.subject.subjectCode} · {attempt.assessment.offering.subject.subjectName}</p></div>
                <div className="bg-card px-4 py-3"><p className="text-muted-foreground text-xs">Attempt started</p><p className="mt-0.5 text-sm font-medium tabular-nums">{DATE_TIME.format(attempt.startAt)}</p></div>
                <div className="bg-card px-4 py-3"><p className="text-muted-foreground text-xs">Due</p><p className="mt-0.5 text-sm font-medium tabular-nums">{attempt.assessment.dueAt ? DATE_TIME.format(attempt.assessment.dueAt) : attempt.assessment.expectedDue ?? 'Not set'}</p></div>
            </section>

            <AttemptReviewWorkspace
                attemptId={attempt.id}
                institutionId={access.active.institution.id}
                contextQuery={markingContextQuery(access)}
                marks={marks}
                flags={flags}
                canViewMarks={canViewMarks}
                canReplay={access.capabilities.canReplay}
                canMark={access.capabilities.canMark}
                replay={
                    replaySession && access.capabilities.canReplay
                        ? {
                              workSessionId: replaySession.id,
                              toolName: replaySession.tool.name,
                              roleAssignmentId: access.active.assignmentId,
                          }
                        : null
                }
            />
        </main>
    );
}
