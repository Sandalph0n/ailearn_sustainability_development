import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowLeft01Icon,
    BookOpen01Icon,
    Calendar03Icon,
    UserMultipleIcon,
} from '@hugeicons/core-free-icons';
import { z } from 'zod';

import {
    AssessmentsTable,
    type AssessmentListItem,
} from '@/components/admin/offerings/assessments-table';
import { Button } from '@/components/ui/button';
import { findContextForTarget } from '@/lib/auth/authorization-policy';
import { listAuthorizedContextOptions } from '@/lib/auth/authorization-service';
import { hasAnyPermission, hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session/service';
import { CONTEXT_PARAM } from '@/lib/context/context-params';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ASSESSMENT_ACTIONS = [
    PERMISSION_CODE.ASSESSMENT_CREATE,
    PERMISSION_CODE.ASSESSMENT_VIEW,
    PERMISSION_CODE.ASSESSMENT_UPDATE,
    PERMISSION_CODE.ASSESSMENT_DELETE,
] as const;
const PAGE_ACTIONS = [PERMISSION_CODE.OFFERING_VIEW, ...ASSESSMENT_ACTIONS] as const;
const PEOPLE_ACTIONS = [
    PERMISSION_CODE.MEMBER_VIEW,
    PERMISSION_CODE.ROLE_ASSIGNMENT_VIEW,
    PERMISSION_CODE.ROLE_ASSIGNMENT_CREATE,
    PERMISSION_CODE.ROLE_ASSIGNMENT_REVOKE,
    PERMISSION_CODE.SCOPE_ASSIGNMENT_VIEW,
    PERMISSION_CODE.SCOPE_ASSIGNMENT_CREATE,
    PERMISSION_CODE.SCOPE_ASSIGNMENT_REVOKE,
] as const;

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

export default async function InstitutionOfferingAssessmentsPage({
    params,
    searchParams,
}: PageProps<'/navigation/institution/offerings/[offeringId]'>) {
    const [{ offeringId }, query] = await Promise.all([params, searchParams]);
    if (!z.uuid().safeParse(offeringId).success) notFound();

    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    // Resolve the resource boundary from PostgreSQL before evaluating the role supplied by URL.
    // This prevents a forged institution query from turning an institution role into cross-school
    // access to an offering that belongs elsewhere.
    const boundary = await db.offering.findUnique({
        where: { id: offeringId },
        select: { subject: { select: { institutionId: true } } },
    });
    if (!boundary) notFound();

    const institutionId = boundary.subject.institutionId;
    const selectedInstitutionId = first(query[CONTEXT_PARAM.institution]);
    const roleId = first(query[CONTEXT_PARAM.role]);
    if (!roleId || selectedInstitutionId !== institutionId) {
        redirect('/navigation/dashboard');
    }

    const contexts = await listAuthorizedContextOptions(session.user.id);
    const active = findContextForTarget(
        contexts,
        { institutionId, roleId },
        { kind: 'OFFERING', institutionId, offeringId },
    );
    if (!active || !hasAnyPermission(active.permissions, PAGE_ACTIONS)) {
        redirect('/navigation/dashboard');
    }

    const capabilities = {
        create: hasPermission(active.permissions, PERMISSION_CODE.ASSESSMENT_CREATE),
        view: hasPermission(active.permissions, PERMISSION_CODE.ASSESSMENT_VIEW),
        update: hasPermission(active.permissions, PERMISSION_CODE.ASSESSMENT_UPDATE),
        delete: hasPermission(active.permissions, PERMISSION_CODE.ASSESSMENT_DELETE),
    };
    const canConfigureTools = capabilities.create || capabilities.update;
    const canReviewAttempts =
        hasPermission(active.permissions, PERMISSION_CODE.ATTEMPT_VIEW_ALL) &&
        hasPermission(active.permissions, PERMISSION_CODE.TOOL_SESSION_REPLAY_ALL);

    const [offering, assessmentRows, tools, aggregate] = await Promise.all([
        db.offering.findUnique({
            where: { id: offeringId },
            select: {
                id: true,
                subject: { select: { id: true, subjectCode: true, subjectName: true } },
                term: { select: { id: true, year: true, session: true } },
            },
        }),
        capabilities.view
            ? db.assessment.findMany({
                  where: { offeringId },
                  orderBy: [
                      { dueAt: { sort: 'asc', nulls: 'last' } },
                      { id: 'asc' },
                  ],
                  select: {
                      id: true,
                      name: true,
                      description: true,
                      weight: true,
                      hurdle: true,
                      isGroup: true,
                      publishAt: true,
                      dueAt: true,
                      expectedDue: true,
                      allowedTools: {
                          select: {
                              tool: { select: { id: true, code: true, name: true } },
                          },
                      },
                      _count: { select: { attempts: true } },
                  },
              })
            : Promise.resolve([]),
        canConfigureTools
            ? db.tool.findMany({
                  orderBy: [{ name: 'asc' }, { id: 'asc' }],
                  select: { id: true, code: true, name: true, description: true },
              })
            : Promise.resolve([]),
        db.assessment.aggregate({
            where: { offeringId },
            _sum: { weight: true },
        }),
    ]);
    if (!offering) notFound();

    const assessments: AssessmentListItem[] = assessmentRows.map((assessment) => ({
        id: assessment.id,
        name: assessment.name,
        description: assessment.description,
        weight: assessment.weight,
        hurdle: assessment.hurdle,
        isGroup: assessment.isGroup,
        publishAt: assessment.publishAt?.toISOString() ?? null,
        dueAt: assessment.dueAt?.toISOString() ?? null,
        expectedDue: assessment.expectedDue,
        published: assessment.publishAt ? DATE_TIME.format(assessment.publishAt) : null,
        due: assessment.dueAt ? DATE_TIME.format(assessment.dueAt) : null,
        tools: assessment.allowedTools.map((edge) => edge.tool),
        attempts: assessment._count.attempts,
    }));
    const totalWeight = aggregate._sum.weight ?? 0;
    const contextQuery = new URLSearchParams({
        [CONTEXT_PARAM.institution]: institutionId,
        [CONTEXT_PARAM.role]: roleId,
    }).toString();
    const offeringContextQuery = new URLSearchParams({
        [CONTEXT_PARAM.institution]: institutionId,
        [CONTEXT_PARAM.role]: roleId,
        [CONTEXT_PARAM.offering]: offering.id,
    }).toString();
    const canOpenSubject =
        active.role.scopeType === 'INSTITUTION' &&
        hasPermission(active.permissions, PERMISSION_CODE.SUBJECT_VIEW);
    const canOpenTerm =
        active.role.scopeType === 'INSTITUTION' &&
        hasPermission(active.permissions, PERMISSION_CODE.TERM_VIEW);
    const canOpenPeople = hasAnyPermission(active.permissions, PEOPLE_ACTIONS);

    return (
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 py-7">
            <div className="border-b pb-5">
                <Button
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    render={
                        <Link
                            href={`/navigation/institution/offerings?${contextQuery}`}
                        />
                    }
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                    Offerings
                </Button>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                            Offering workspace
                        </p>
                        <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
                            {offering.subject.subjectCode} · {offering.term.year} Session{' '}
                            {offering.term.session}
                        </h1>
                        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                            {offering.subject.subjectName}. Continue to related catalog, calendar,
                            people, and assessment work from this offering.
                        </p>
                    </div>
                    <nav aria-label="Related offering pages" className="flex flex-wrap gap-2">
                        {canOpenSubject && (
                            <Button
                                nativeButton={false}
                                variant="outline"
                                size="sm"
                                render={
                                    <Link
                                        href={`/navigation/institution/subjects/${offering.subject.id}?${contextQuery}`}
                                    />
                                }
                            >
                                <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} />
                                Subject
                            </Button>
                        )}
                        {canOpenTerm && (
                            <Button
                                nativeButton={false}
                                variant="outline"
                                size="sm"
                                render={
                                    <Link
                                        href={`/navigation/institution/terms/${offering.term.id}?${contextQuery}`}
                                    />
                                }
                            >
                                <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
                                Term
                            </Button>
                        )}
                        {canOpenPeople && (
                            <Button
                                nativeButton={false}
                                variant="outline"
                                size="sm"
                                render={
                                    <Link
                                        href={`/navigation/institution/people?${offeringContextQuery}`}
                                    />
                                }
                            >
                                <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} />
                                People &amp; access
                            </Button>
                        )}
                    </nav>
                </div>
            </div>

            <AssessmentsTable
                assessments={assessments}
                offeringId={offering.id}
                tools={tools}
                totalWeight={totalWeight}
                endpoint={`/api/institutions/${institutionId}/offerings/${offering.id}/assessments`}
                contextQuery={contextQuery}
                capabilities={capabilities}
                canReviewAttempts={canReviewAttempts}
                emptyMessage={
                    capabilities.view
                        ? undefined
                        : 'Existing assessments are hidden because this role does not have assessment.view.'
                }
            />
        </main>
    );
}
