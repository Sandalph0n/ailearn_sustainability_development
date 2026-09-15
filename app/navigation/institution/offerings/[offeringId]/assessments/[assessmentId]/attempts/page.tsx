import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';

import { LaunchReplayButton } from '@/components/navigation/learning/replay-actions';
import { LearningPageHeader } from '@/components/navigation/learning/page-header';
import { Badge } from '@/components/ui/badge';
import { findContextForTarget } from '@/lib/auth/authorization-policy';
import { listAuthorizedContextOptions } from '@/lib/auth/authorization-service';
import { hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session/service';
import { CONTEXT_PARAM } from '@/lib/context/context-params';
import { db } from '@/lib/db';

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

export default async function AssessmentAttemptsPage({
    params,
    searchParams,
}: PageProps<'/navigation/institution/offerings/[offeringId]/assessments/[assessmentId]/attempts'>) {
    const [{ offeringId, assessmentId }, query] = await Promise.all([params, searchParams]);
    if (!z.uuid().safeParse(offeringId).success || !z.uuid().safeParse(assessmentId).success) notFound();

    const auth = await getCurrentSession();
    if (!auth) redirect('/api/auth/clear-invalid-session');

    const assessment = await db.assessment.findFirst({
        where: { id: assessmentId, offeringId },
        select: {
            id: true,
            name: true,
            offering: {
                select: {
                    id: true,
                    subject: { select: { institutionId: true, subjectCode: true, subjectName: true } },
                    term: { select: { year: true, session: true } },
                },
            },
        },
    });
    if (!assessment) notFound();

    const institutionId = assessment.offering.subject.institutionId;
    const selectedInstitutionId = first(query[CONTEXT_PARAM.institution]);
    const roleId = first(query[CONTEXT_PARAM.role]);
    if (!roleId || selectedInstitutionId !== institutionId) redirect('/navigation/dashboard');

    const contexts = await listAuthorizedContextOptions(auth.user.id);
    const access = findContextForTarget(
        contexts,
        { institutionId, roleId },
        { kind: 'OFFERING', institutionId, offeringId },
    );
    if (
        !access ||
        !hasPermission(access.permissions, PERMISSION_CODE.ATTEMPT_VIEW_ALL)
    ) {
        redirect('/navigation/dashboard');
    }
    const canReplay = hasPermission(
        access.permissions,
        PERMISSION_CODE.TOOL_SESSION_REPLAY_ALL,
    );

    const attempts = await db.assessmentAttempt.findMany({
        where: { assessmentId },
        orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
        select: {
            id: true,
            startAt: true,
            submitAt: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            workspace: {
                select: {
                    workSessions: {
                        orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
                        select: {
                            id: true,
                            startAt: true,
                            endAt: true,
                            tool: { select: { name: true, code: true } },
                            toolVersion: { select: { version: true } },
                            _count: { select: { eventBatches: true } },
                            eventBatches: {
                                orderBy: { seqEnd: 'desc' },
                                take: 1,
                                select: { seqEnd: true },
                            },
                        },
                    },
                },
            },
        },
    });

    const contextQuery = new URLSearchParams({
        [CONTEXT_PARAM.institution]: institutionId,
        [CONTEXT_PARAM.role]: roleId,
    }).toString();

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <LearningPageHeader
                eyebrow={`${assessment.offering.subject.subjectCode} · Assessment review`}
                title={assessment.name}
                description={`Review student attempts and open the exact tool version that recorded each work session. ${assessment.offering.term.year} Session ${assessment.offering.term.session}.`}
                back={{
                    href: `/navigation/institution/offerings/${offeringId}?${contextQuery}`,
                    label: 'Assessment management',
                }}
            />

            <div className="overflow-hidden rounded-lg border bg-card">
                <div className="grid grid-cols-[minmax(15rem,1.25fr)_9rem_8rem_minmax(26rem,2fr)] gap-4 border-b bg-muted/35 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Student</span>
                    <span>Started</span>
                    <span>Status</span>
                    <span>Recorded sessions</span>
                </div>
                {attempts.length === 0 ? (
                    <p className="px-4 py-12 text-center text-sm text-muted-foreground">No attempts have been started.</p>
                ) : (
                    attempts.map((attempt) => {
                        const displayName = [attempt.user.firstName, attempt.user.lastName].filter(Boolean).join(' ') || attempt.user.email;
                        const sessions = attempt.workspace?.workSessions ?? [];
                        return (
                            <section
                                key={attempt.id}
                                className="grid grid-cols-[minmax(15rem,1.25fr)_9rem_8rem_minmax(26rem,2fr)] gap-4 border-b px-4 py-4 last:border-b-0"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{displayName}</p>
                                    <p className="truncate text-xs text-muted-foreground">{attempt.user.email}</p>
                                </div>
                                <time className="text-sm tabular-nums">{DATE_TIME.format(attempt.startAt)}</time>
                                <div>
                                    <Badge variant={attempt.submitAt ? 'secondary' : 'outline'}>
                                        {attempt.submitAt ? 'Submitted' : 'Active'}
                                    </Badge>
                                </div>
                                <div className="grid gap-2">
                                    {sessions.length === 0 ? (
                                        <span className="text-sm text-muted-foreground">No tool activity recorded.</span>
                                    ) : (
                                        sessions.map((workSession) => (
                                            <div key={workSession.id} className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium">
                                                        {workSession.tool.name} · {workSession.toolVersion?.version ?? 'legacy version'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {DATE_TIME.format(workSession.startAt)} · {(workSession.eventBatches[0]?.seqEnd ?? -1) + 1} events · {workSession.endAt ? 'closed' : 'open'}
                                                    </p>
                                                </div>
                                                {canReplay ? (
                                                    <LaunchReplayButton
                                                        workSessionId={workSession.id}
                                                        roleAssignmentId={access.assignmentId}
                                                        toolName={workSession.tool.name}
                                                    />
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">
                                                        Replay unavailable for this role
                                                    </span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        );
                    })
                )}
            </div>
        </main>
    );
}
