import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { z } from 'zod';

import {
    PeriodsTable,
    type TermPeriodListItem,
} from '@/components/admin/terms/periods-table';
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

export default async function InstitutionTermPeriodsPage({
    params,
}: PageProps<'/admin/institutions/[id]/terms/[termId]'>) {
    const { id: institutionId, termId } = await params;
    if (!z.uuid().safeParse(termId).success) notFound();

    // Ghép cả institutionId vào điều kiện để URL không thể mượn term của một trường khác.
    const term = await db.studyTerm.findFirst({
        where: { id: termId, institutionId },
        select: {
            id: true,
            year: true,
            session: true,
            periods: {
                orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
                select: { id: true, name: true, type: true, startAt: true, endAt: true },
            },
        },
    });
    if (!term) notFound();

    const periods: TermPeriodListItem[] = term.periods.map((period) => ({
        id: period.id,
        name: period.name,
        type: period.type,
        startAt: period.startAt.toISOString(),
        endAt: period.endAt.toISOString(),
        starts: DATE_TIME.format(period.startAt),
        ends: DATE_TIME.format(period.endAt),
    }));

    return (
        <div className="flex flex-col gap-5 pt-2">
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    render={<Link href={`/admin/institutions/${institutionId}/terms`} />}
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                    Terms
                </Button>
                <h2 className="font-heading mt-2 text-lg font-semibold tracking-tight">
                    {term.year} · Session {term.session}
                </h2>
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                    Periods turn a term into usable calendar windows for teaching, breaks and exams.
                </p>
            </div>

            <PeriodsTable periods={periods} termId={term.id} />
        </div>
    );
}
