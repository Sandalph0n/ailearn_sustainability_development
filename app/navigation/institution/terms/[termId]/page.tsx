import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { z } from 'zod';

import { PeriodsTable, type TermPeriodListItem } from '@/components/admin/terms/periods-table';
import { Button } from '@/components/ui/button';
import { requireInstitutionWorkspace } from '@/lib/auth/institution-workspace';
import { hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { contextSearchParams } from '@/lib/context/context-params';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TERM_ACTIONS = [
    PERMISSION_CODE.TERM_CREATE,
    PERMISSION_CODE.TERM_VIEW,
    PERMISSION_CODE.TERM_UPDATE,
    PERMISSION_CODE.TERM_DELETE,
] as const;
const DATE_TIME = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'Australia/Sydney',
});

export default async function InstitutionTermPeriodsPage({
    params,
    searchParams,
}: PageProps<'/navigation/institution/terms/[termId]'>) {
    const { termId } = await params;
    if (!z.uuid().safeParse(termId).success) notFound();
    const query = await searchParams;
    const active = await requireInstitutionWorkspace(query, TERM_ACTIONS);
    const term = await db.studyTerm.findFirst({
        where: { id: termId, institutionId: active.institution.id },
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
    const contextQuery = new URLSearchParams(contextSearchParams(active)).toString();
    const capabilities = {
        create: hasPermission(active.permissions, PERMISSION_CODE.TERM_UPDATE),
        view: hasPermission(active.permissions, PERMISSION_CODE.TERM_VIEW),
        update: hasPermission(active.permissions, PERMISSION_CODE.TERM_UPDATE),
        delete: hasPermission(active.permissions, PERMISSION_CODE.TERM_DELETE),
    };

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <Button
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="-ml-3"
                render={<Link href={`/navigation/institution/terms?${contextQuery}`} />}
            >
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                Terms
            </Button>
            <header className="mt-2 mb-6 border-b pb-5">
                <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    Term calendar
                </p>
                <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
                    {term.year} · Session {term.session}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Define teaching, break and exam windows for {active.institution.name}.
                </p>
            </header>
            <PeriodsTable
                periods={periods}
                termId={term.id}
                endpoint={`/api/institutions/${active.institution.id}/terms/${term.id}/periods`}
                contextQuery={contextQuery}
                capabilities={capabilities}
            />
        </main>
    );
}
