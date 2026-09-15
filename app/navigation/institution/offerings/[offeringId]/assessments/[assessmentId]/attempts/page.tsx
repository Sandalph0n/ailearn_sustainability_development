import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';

import {
    AssessmentAttemptBrowser,
    type ReviewStudent,
} from '@/components/navigation/learning/assessment-attempt-browser';
import { LearningPageHeader } from '@/components/navigation/learning/page-header';
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
                            tool: { select: { name: true } },
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

    const studentsById = new Map<string, ReviewStudent>();
    for (const attempt of attempts) {
        const displayName =
            [attempt.user.firstName, attempt.user.lastName].filter(Boolean).join(' ') ||
            attempt.user.email;
        const sessions = attempt.workspace?.workSessions ?? [];
        const sessionEvents = sessions.map((session) => ({
            session,
            eventCount: Math.max(0, (session.eventBatches[0]?.seqEnd ?? -1) + 1),
        }));
        const replaySource =
            sessionEvents.find(({ eventCount }) => eventCount > 0)?.session ?? sessions[0] ?? null;
        const record = studentsById.get(attempt.user.id) ?? {
            id: attempt.user.id,
            displayName,
            email: attempt.user.email,
            attempts: [],
        };
        record.attempts.push({
            id: attempt.id,
            number: 0,
            startedAt: DATE_TIME.format(attempt.startAt),
            submitted: attempt.submitAt !== null,
            sessionCount: sessions.length,
            eventCount: sessionEvents.reduce((total, item) => total + item.eventCount, 0),
            toolNames: [...new Set(sessions.map((session) => session.tool.name))],
            replay: replaySource
                ? { workSessionId: replaySource.id, toolName: replaySource.tool.name }
                : null,
        });
        studentsById.set(attempt.user.id, record);
    }
    const students = [...studentsById.values()]
        .map((student) => ({
            ...student,
            attempts: student.attempts.map((attempt, index, all) => ({
                ...attempt,
                number: all.length - index,
            })),
        }))
        .sort((left, right) =>
            left.displayName.localeCompare(right.displayName, 'en', { sensitivity: 'base' }),
        );

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <LearningPageHeader
                eyebrow={`${assessment.offering.subject.subjectCode} · Assessment review`}
                title={assessment.name}
                description={`Choose a student, then review each attempt as one complete replay. ${assessment.offering.term.year} Session ${assessment.offering.term.session}.`}
                back={{
                    href: `/navigation/institution/offerings/${offeringId}?${contextQuery}`,
                    label: 'Assessment management',
                }}
            />

            <AssessmentAttemptBrowser
                students={students}
                canReplay={canReplay}
                roleAssignmentId={access.assignmentId}
            />
        </main>
    );
}
