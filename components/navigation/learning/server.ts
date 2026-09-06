import 'server-only';

import type { Prisma } from '@/app/generated/prisma/client';
import { redirect } from 'next/navigation';

import { listAuthorizedContextOptions } from '@/lib/auth/authorization-service';
import { PERMISSION_CODE, type PermissionCode } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session/service';
import { CONTEXT_PARAM } from '@/lib/context/context-params';
import { db } from '@/lib/db';
import {
    accessCoversOffering,
    canViewOwnAttempts,
    canViewPublishedAssessments,
    firstLearningAccessWithPermission,
    learningAccessForSelector,
    learningAccessWithPermission,
    type LearningAccess,
    type LearningRoleSelector,
} from './policy';
import type {
    LearningAssessmentDetail,
    LearningAssessmentSummary,
    LearningAttemptSummary,
    LearningOfferingDetail,
    LearningOfferingSummary,
} from './types';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export function selectorFromSearchParams(searchParams: SearchParams): LearningRoleSelector | null {
    const institutionId = first(searchParams[CONTEXT_PARAM.institution]);
    const roleId = first(searchParams[CONTEXT_PARAM.role]);
    const offeringId = first(searchParams[CONTEXT_PARAM.offering]);

    if (!institutionId || !roleId) return null;
    return { institutionId, roleId, offeringId };
}

export function selectorFromUrl(url: URL): LearningRoleSelector | null {
    const institutionId = url.searchParams.get(CONTEXT_PARAM.institution);
    const roleId = url.searchParams.get(CONTEXT_PARAM.role);
    const offeringId = url.searchParams.get(CONTEXT_PARAM.offering);

    if (!institutionId || !roleId) return null;
    return { institutionId, roleId, offeringId };
}

export async function resolveLearningAccess(
    userId: string,
    selector: LearningRoleSelector,
    permission?: PermissionCode,
): Promise<LearningAccess | null> {
    const contexts = await listAuthorizedContextOptions(userId);
    return permission
        ? learningAccessWithPermission(contexts, selector, permission)
        : learningAccessForSelector(contexts, selector);
}

/** Pages may choose a useful default only when the URL supplied no context at all. */
export async function requireLearningPageAccess(
    searchParams: SearchParams,
    permission: PermissionCode = PERMISSION_CODE.OFFERING_VIEW,
): Promise<{ userId: string; access: LearningAccess }> {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const contexts = await listAuthorizedContextOptions(session.user.id);
    const selector = selectorFromSearchParams(searchParams);
    const suppliedContext = Boolean(
        first(searchParams[CONTEXT_PARAM.institution]) ||
            first(searchParams[CONTEXT_PARAM.role]) ||
            first(searchParams[CONTEXT_PARAM.offering]),
    );
    const access = selector
        ? learningAccessWithPermission(contexts, selector, permission)
        : suppliedContext
          ? null
          : firstLearningAccessWithPermission(contexts, permission);

    if (!access) redirect('/navigation/dashboard');
    return { userId: session.user.id, access };
}

export function learningContextParams(
    access: LearningAccess,
    offeringId?: string,
): URLSearchParams {
    const params = new URLSearchParams({
        [CONTEXT_PARAM.institution]: access.institution.id,
        [CONTEXT_PARAM.role]: access.role.id,
    });
    if (offeringId && access.role.scopeType === 'OFFERING') {
        params.set(CONTEXT_PARAM.offering, offeringId);
    }
    return params;
}

export function learningHref(
    pathname: string,
    access: LearningAccess,
    offeringId?: string,
): string {
    return `${pathname}?${learningContextParams(access, offeringId).toString()}`;
}

function offeringWhere(
    access: LearningAccess,
    offeringId?: string,
): Prisma.OfferingWhereInput {
    return {
        ...(access.offeringIds === null
            ? offeringId
                ? { id: offeringId }
                : {}
            : {
                  id: {
                      in: offeringId
                          ? access.offeringIds.has(offeringId)
                              ? [offeringId]
                              : []
                          : [...access.offeringIds],
                  },
              }),
        subject: { institutionId: access.institution.id },
    };
}

const offeringSelect = {
    id: true,
    subject: {
        select: {
            institution: { select: { id: true, name: true } },
            subjectCode: true,
            subjectName: true,
            subjectDescription: true,
        },
    },
    term: {
        select: {
            id: true,
            year: true,
            session: true,
            periods: {
                orderBy: { startAt: 'asc' as const },
                select: { startAt: true, endAt: true },
            },
        },
    },
} as const;

function serializeOffering(
    row: {
        id: string;
        subject: {
            institution: { id: string; name: string };
            subjectCode: string;
            subjectName: string;
            subjectDescription: string | null;
        };
        term: {
            id: string;
            year: number;
            session: number;
            periods: Array<{ startAt: Date; endAt: Date }>;
        };
    },
    publishedAssessmentCount: number | null,
): LearningOfferingSummary {
    return {
        id: row.id,
        institution: row.subject.institution,
        subject: {
            code: row.subject.subjectCode,
            name: row.subject.subjectName,
            description: row.subject.subjectDescription,
        },
        term: {
            ...row.term,
            periods: row.term.periods.map((period) => ({
                startAt: period.startAt.toISOString(),
                endAt: period.endAt.toISOString(),
            })),
        },
        publishedAssessmentCount,
    };
}

export async function listLearningOfferings(
    access: LearningAccess,
    now: Date,
): Promise<LearningOfferingSummary[]> {
    const maySeeAssessments = canViewPublishedAssessments(access);
    const rows = await db.offering.findMany({
        where: offeringWhere(access),
        orderBy: [
            { term: { year: 'desc' } },
            { term: { session: 'desc' } },
            { subject: { subjectCode: 'asc' } },
        ],
        select: {
            ...offeringSelect,
            ...(maySeeAssessments
                ? {
                      _count: {
                          select: { assessments: { where: { publishAt: { lte: now } } } },
                      },
                  }
                : {}),
        },
    });

    return rows.map((row) =>
        serializeOffering(
            row,
            maySeeAssessments && '_count' in row ? row._count.assessments : null,
        ),
    );
}

function serializeAssessment(
    row: {
        id: string;
        name: string;
        description: string | null;
        weight: number;
        hurdle: boolean;
        isGroup: boolean;
        publishAt: Date | null;
        dueAt: Date | null;
        expectedDue: string | null;
    },
    ownAttemptCount: number | null,
): LearningAssessmentSummary {
    if (!row.publishAt) throw new Error('Draft assessment reached the student serializer');
    return {
        ...row,
        publishAt: row.publishAt.toISOString(),
        dueAt: row.dueAt?.toISOString() ?? null,
        ownAttemptCount,
    };
}

export async function getLearningOffering(
    userId: string,
    access: LearningAccess,
    offeringId: string,
    now: Date,
): Promise<LearningOfferingDetail | null> {
    if (!accessCoversOffering(access, offeringId)) return null;

    const maySeeAssessments = canViewPublishedAssessments(access);
    const maySeeAttempts = canViewOwnAttempts(access);
    const row = await db.offering.findFirst({
        where: offeringWhere(access, offeringId),
        select: {
            ...offeringSelect,
            ...(maySeeAssessments
                ? {
                      assessments: {
                          where: { publishAt: { lte: now } },
                          orderBy: [{ dueAt: 'asc' as const }, { name: 'asc' as const }],
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
                              ...(maySeeAttempts
                                  ? {
                                        _count: {
                                            select: { attempts: { where: { userId } } },
                                        },
                                    }
                                  : {}),
                          },
                      },
                  }
                : {}),
        },
    });
    if (!row) return null;

    const assessments =
        maySeeAssessments && 'assessments' in row
            ? row.assessments.map((assessment) =>
                  serializeAssessment(
                      assessment,
                      maySeeAttempts
                          ? (
                                assessment as typeof assessment & {
                                    _count: { attempts: number };
                                }
                            )._count.attempts
                          : null,
                  ),
              )
            : null;

    return {
        ...serializeOffering(row, assessments?.length ?? null),
        assessments,
    };
}

export async function getPublishedAssessment(
    access: LearningAccess,
    assessmentId: string,
    now: Date,
): Promise<LearningAssessmentDetail | null> {
    if (!canViewPublishedAssessments(access)) return null;

    const row = await db.assessment.findFirst({
        where: {
            id: assessmentId,
            publishAt: { lte: now },
            offering: offeringWhere(access),
        },
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
            offering: { select: offeringSelect },
        },
    });
    if (!row || !row.publishAt) return null;

    return {
        ...serializeAssessment(row, null),
        offering: serializeOffering(row.offering, null),
    };
}

export async function listOwnAttempts(
    userId: string,
    access: LearningAccess,
    assessmentId: string,
    now: Date,
): Promise<LearningAttemptSummary[] | null> {
    const assessment = await getPublishedAssessment(access, assessmentId, now);
    if (!assessment || !canViewOwnAttempts(access)) return null;

    const rows = await db.assessmentAttempt.findMany({
        where: { userId, assessmentId },
        orderBy: { startAt: 'desc' },
        select: {
            id: true,
            startAt: true,
            submitAt: true,
            workspace: {
                select: {
                    workspace: {
                        select: { id: true, name: true, lastOpenedAt: true },
                    },
                },
            },
        },
    });

    return rows.flatMap((row) =>
        row.workspace
            ? [
                  {
                      id: row.id,
                      startAt: row.startAt.toISOString(),
                      submitAt: row.submitAt?.toISOString() ?? null,
                      workspace: {
                          ...row.workspace.workspace,
                          lastOpenedAt:
                              row.workspace.workspace.lastOpenedAt?.toISOString() ?? null,
                      },
                  },
              ]
            : [],
    );
}

export async function getOwnAttempt(
    userId: string,
    access: LearningAccess,
    attemptId: string,
    now: Date,
): Promise<{
    attempt: LearningAttemptSummary;
    assessment: LearningAssessmentDetail;
} | null> {
    if (!canViewOwnAttempts(access)) return null;
    const row = await db.assessmentAttempt.findFirst({
        where: {
            id: attemptId,
            userId,
            assessment: {
                publishAt: { lte: now },
                offering: offeringWhere(access),
            },
        },
        select: {
            id: true,
            startAt: true,
            submitAt: true,
            workspace: {
                select: {
                    workspace: { select: { id: true, name: true, lastOpenedAt: true } },
                },
            },
            assessment: {
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
                    offering: { select: offeringSelect },
                },
            },
        },
    });
    if (!row?.workspace || !row.assessment.publishAt) return null;

    return {
        attempt: {
            id: row.id,
            startAt: row.startAt.toISOString(),
            submitAt: row.submitAt?.toISOString() ?? null,
            workspace: {
                ...row.workspace.workspace,
                lastOpenedAt: row.workspace.workspace.lastOpenedAt?.toISOString() ?? null,
            },
        },
        assessment: {
            ...serializeAssessment(row.assessment, null),
            offering: serializeOffering(row.assessment.offering, null),
        },
    };
}
