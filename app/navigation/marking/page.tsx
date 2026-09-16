import { LearningPageHeader } from '@/components/navigation/learning/page-header';
import {
    MarkingWorkspace,
    type MarkingStudentSummary,
    type MarkingTermSummary,
} from '@/components/navigation/marking/marking-workspace';
import { db } from '@/lib/db';
import {
    markingContextQuery,
    markingOfferingWhere,
    requireMarkingAccess,
} from '@/lib/marking/access';

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

export default async function MarkingPage({ searchParams }: PageProps<'/navigation/marking'>) {
    const query = await searchParams;
    const access = await requireMarkingAccess(query);
    const offeringWhere = markingOfferingWhere(access);
    const canBrowseAttempts =
        access.capabilities.canViewAttempt ||
        access.capabilities.canReplay ||
        access.capabilities.canMark;
    const now = new Date();

    const terms = await db.studyTerm.findMany({
        where: {
            institutionId: access.active.institution.id,
            offerings: { some: offeringWhere },
        },
        orderBy: [{ year: 'desc' }, { session: 'desc' }],
        select: {
            id: true,
            year: true,
            session: true,
            periods: {
                orderBy: { startAt: 'asc' },
                select: { name: true, startAt: true, endAt: true },
            },
            offerings: {
                where: offeringWhere,
                orderBy: { subject: { subjectCode: 'asc' } },
                select: {
                    subject: { select: { id: true, subjectCode: true, subjectName: true } },
                    assessments: {
                        orderBy: [{ publishAt: 'asc' }, { name: 'asc' }],
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
    });

    const attempts = canBrowseAttempts
        ? await db.assessmentAttempt.findMany({
              where: { assessment: { offering: offeringWhere } },
              orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
              select: {
                  id: true,
                  startAt: true,
                  submitAt: true,
                  user: {
                      select: { id: true, firstName: true, lastName: true, email: true },
                  },
                  assessment: {
                      select: {
                          name: true,
                          offering: {
                              select: { termId: true, subjectId: true },
                          },
                      },
                  },
                  marks: {
                      where: { markedById: access.userId, status: 'DRAFT' },
                      take: 1,
                      select: { id: true },
                  },
                  result: {
                      select: { mark: { select: { score: true, outOf: true } } },
                  },
                  _count: { select: { marks: true } },
              },
          })
        : [];
    const attemptsByTermSubject = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
        const key = `${attempt.assessment.offering.termId}:${attempt.assessment.offering.subjectId}`;
        const siblings = attemptsByTermSubject.get(key) ?? [];
        siblings.push(attempt);
        attemptsByTermSubject.set(key, siblings);
    }

    const termData: MarkingTermSummary[] = terms.map((term) => {
        const currentPeriod = term.periods.find(
            (period) => period.startAt <= now && period.endAt >= now,
        );
        const subjects = term.offerings.map((offering) => {
            const students = new Map<string, MarkingStudentSummary>();
            const subjectAttempts = attemptsByTermSubject.get(`${term.id}:${offering.subject.id}`) ?? [];
            for (const attempt of subjectAttempts) {
                    const displayName =
                        [attempt.user.firstName, attempt.user.lastName].filter(Boolean).join(' ') ||
                        attempt.user.email;
                    const student = students.get(attempt.user.id) ?? {
                        id: attempt.user.id,
                        displayName,
                        email: attempt.user.email,
                        attempts: [],
                    };
                    student.attempts.push({
                        id: attempt.id,
                        assessmentName: attempt.assessment.name,
                        startedAt: DATE_TIME.format(attempt.startAt),
                        submitted: attempt.submitAt !== null,
                        markCount: attempt._count.marks,
                        hasDraft: attempt.marks.length > 0,
                        officialScore: attempt.result
                            ? `${attempt.result.mark.score?.toString() ?? '—'} / ${attempt.result.mark.outOf.toString()}`
                            : null,
                    });
                    students.set(attempt.user.id, student);
            }

            return {
                id: offering.subject.id,
                code: offering.subject.subjectCode,
                name: offering.subject.subjectName,
                assessmentCount: offering.assessments.length,
                students: [...students.values()].sort((left, right) =>
                    left.displayName.localeCompare(right.displayName, 'en', { sensitivity: 'base' }),
                ),
            };
        });

        return {
            id: term.id,
            label: `${term.year} Session ${term.session}`,
            current: Boolean(currentPeriod),
            periodLabel: currentPeriod?.name ?? null,
            subjects,
        };
    });

    return (
        <main className="mx-auto w-full max-w-[92rem] py-7">
            <LearningPageHeader
                eyebrow="Assessment evidence"
                title="Marking & Replay"
                description={`Review student work across ${access.active.institution.name}. Available actions follow the active role: ${access.active.role.roleName}.`}
            />
            <MarkingWorkspace
                terms={termData}
                initialSelection={{
                    termId: first(query.termId),
                    subjectId: first(query.subjectId),
                    studentId: first(query.studentId),
                }}
                contextQuery={markingContextQuery(access)}
                canBrowseAttempts={canBrowseAttempts}
            />
        </main>
    );
}
