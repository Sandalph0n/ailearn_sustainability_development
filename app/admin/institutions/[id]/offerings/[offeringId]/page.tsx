import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { z } from 'zod';

import {
    AssessmentsTable,
    type AssessmentListItem,
} from '@/components/admin/offerings/assessments-table';
import { Button } from '@/components/ui/button';
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

export default async function InstitutionOfferingPage({
    params,
}: PageProps<'/admin/institutions/[id]/offerings/[offeringId]'>) {
    const { id: institutionId, offeringId } = await params;
    if (!z.uuid().safeParse(offeringId).success) notFound();

    const [offering, tools] = await Promise.all([
        db.offering.findFirst({
            where: { id: offeringId, subject: { institutionId } },
            select: {
                id: true,
                subject: { select: { subjectCode: true, subjectName: true } },
                term: { select: { year: true, session: true } },
                assessments: {
                    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        weight: true,
                        hurdle: true,
                        isGroup: true,
                        publishAt: true,
                        dueAt: true,
                        allowedTools: {
                            select: { tool: { select: { id: true, code: true, name: true } } },
                        },
                        _count: { select: { attempts: true } },
                    },
                },
            },
        }),
        db.tool.findMany({
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            select: { id: true, code: true, name: true, description: true },
        }),
    ]);
    if (!offering) notFound();

    const assessments: AssessmentListItem[] = offering.assessments.map((assessment) => ({
        id: assessment.id,
        name: assessment.name,
        description: assessment.description,
        weight: assessment.weight,
        hurdle: assessment.hurdle,
        isGroup: assessment.isGroup,
        publishAt: assessment.publishAt?.toISOString() ?? null,
        dueAt: assessment.dueAt.toISOString(),
        published: assessment.publishAt ? DATE_TIME.format(assessment.publishAt) : null,
        due: DATE_TIME.format(assessment.dueAt),
        tools: assessment.allowedTools.map((edge) => edge.tool),
        attempts: assessment._count.attempts,
    }));
    const totalWeight = assessments.reduce((sum, assessment) => sum + assessment.weight, 0);

    return (
        <div className="flex flex-col gap-5 pt-2">
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    render={<Link href={`/admin/institutions/${institutionId}/offerings`} />}
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                    Offerings
                </Button>
                <h2 className="font-heading mt-2 text-lg font-semibold tracking-tight">
                    {offering.subject.subjectCode} · {offering.term.year} Session{' '}
                    {offering.term.session}
                </h2>
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                    {offering.subject.subjectName}. Configure grading, dates, hurdle rules and the
                    tools students may use.
                </p>
            </div>

            <AssessmentsTable
                assessments={assessments}
                offeringId={offering.id}
                tools={tools}
                totalWeight={totalWeight}
            />
        </div>
    );
}
