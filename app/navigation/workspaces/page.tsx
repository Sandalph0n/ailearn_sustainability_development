import { redirect } from 'next/navigation';

import { WorkspaceList, type WorkspaceSummary } from '@/components/navigation/workspaces/workspace-list';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function WorkspacesPage() {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const rows = await db.workspace.findMany({
        where: { OR: [{ personal: { userId: session.user.id } }, { assignment: { attempt: { userId: session.user.id } } }] },
        orderBy: [{ lastOpenedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        select: {
            id: true, name: true, createdAt: true, lastOpenedAt: true,
            personal: { select: { userId: true } },
            assignment: {
                select: {
                    attempt: {
                        select: {
                            id: true,
                            startAt: true,
                            submitAt: true,
                            assessment: {
                                select: {
                                    id: true,
                                    name: true,
                                    offering: {
                                        select: {
                                            subject: { select: { subjectCode: true } },
                                            term: { select: { year: true, session: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            _count: { select: { documents: true } },
        },
    });
    const date = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' });
    const dateTime = new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Australia/Sydney',
    });
    const attemptNumbers = new Map<string, number>();
    const attemptsByAssessment = new Map<string, Array<{ id: string; startAt: Date }>>();
    for (const row of rows) {
        const attempt = row.assignment?.attempt;
        if (!attempt) continue;
        const siblings = attemptsByAssessment.get(attempt.assessment.id) ?? [];
        siblings.push({ id: attempt.id, startAt: attempt.startAt });
        attemptsByAssessment.set(attempt.assessment.id, siblings);
    }
    for (const siblings of attemptsByAssessment.values()) {
        siblings
            .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
            .forEach((attempt, index) => attemptNumbers.set(attempt.id, index + 1));
    }
    const workspaces: WorkspaceSummary[] = rows.map((row) => {
        const attempt = row.assignment?.attempt;
        return {
            id: row.id,
            name: row.name,
            kind: row.personal ? 'PERSONAL' : 'ASSIGNMENT',
            detail: attempt ? `${attempt.assessment.offering.subject.subjectCode} · S${attempt.assessment.offering.term.session} ${attempt.assessment.offering.term.year}` : 'Personal workspace · no activity recording',
            updated: date.format(row.lastOpenedAt ?? row.createdAt),
            documentCount: row._count.documents,
            submitted: attempt?.submitAt !== null && attempt?.submitAt !== undefined,
            attemptNumber: attempt ? attemptNumbers.get(attempt.id) : undefined,
            started: attempt ? dateTime.format(attempt.startAt) : undefined,
            href: `/navigation/workspaces/${row.id}`,
        };
    });

    return <main className="mx-auto w-full max-w-7xl py-7"><header className="mb-7 border-b pb-5"><p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">Personal</p><h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">Workspaces</h1><p className="text-muted-foreground mt-1 max-w-2xl text-sm">Continue assessment work or keep private documents in a personal workspace.</p></header><WorkspaceList workspaces={workspaces} /></main>;
}
