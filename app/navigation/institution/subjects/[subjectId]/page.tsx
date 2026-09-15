import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { findContextForTarget } from '@/lib/auth/authorization-policy';
import { listAuthorizedContextOptions } from '@/lib/auth/authorization-service';
import { hasAnyPermission, hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session/service';
import { CONTEXT_PARAM } from '@/lib/context/context-params';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const OFFERING_DESTINATION_PERMISSIONS = [
    PERMISSION_CODE.OFFERING_VIEW,
    PERMISSION_CODE.ASSESSMENT_CREATE,
    PERMISSION_CODE.ASSESSMENT_VIEW,
    PERMISSION_CODE.ASSESSMENT_UPDATE,
    PERMISSION_CODE.ASSESSMENT_DELETE,
] as const;

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export default async function InstitutionSubjectPage({
    params,
    searchParams,
}: PageProps<'/navigation/institution/subjects/[subjectId]'>) {
    const [{ subjectId }, query] = await Promise.all([params, searchParams]);
    if (!z.uuid().safeParse(subjectId).success) notFound();

    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const subject = await db.subject.findUnique({
        where: { id: subjectId },
        select: {
            id: true,
            institutionId: true,
            subjectCode: true,
            subjectName: true,
            subjectDescription: true,
            offerings: {
                orderBy: [{ term: { year: 'desc' } }, { term: { session: 'desc' } }],
                select: {
                    id: true,
                    term: { select: { id: true, year: true, session: true } },
                    _count: { select: { assessments: true, scopeAssignments: true } },
                },
            },
        },
    });
    if (!subject) notFound();

    const selectedInstitutionId = first(query[CONTEXT_PARAM.institution]);
    const roleId = first(query[CONTEXT_PARAM.role]);
    if (!roleId || selectedInstitutionId !== subject.institutionId) {
        redirect('/navigation/dashboard');
    }

    const contexts = await listAuthorizedContextOptions(session.user.id);
    const active = findContextForTarget(
        contexts,
        { institutionId: subject.institutionId, roleId },
        { kind: 'INSTITUTION', institutionId: subject.institutionId },
    );
    if (
        !active ||
        active.role.scopeType !== 'INSTITUTION' ||
        !hasPermission(active.permissions, PERMISSION_CODE.SUBJECT_VIEW)
    ) {
        redirect('/navigation/dashboard');
    }

    const canOpenOfferings = hasAnyPermission(active.permissions, OFFERING_DESTINATION_PERMISSIONS);
    const contextQuery = new URLSearchParams({
        [CONTEXT_PARAM.institution]: subject.institutionId,
        [CONTEXT_PARAM.role]: roleId,
    }).toString();

    return (
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 py-7">
            <header className="border-b pb-5">
                <Button
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    render={<Link href={`/navigation/institution/subjects?${contextQuery}`} />}
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                    Subjects
                </Button>
                <p className="text-primary mt-4 text-xs font-semibold tracking-[0.16em] uppercase">
                    Subject overview
                </p>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="font-heading text-2xl font-semibold tracking-tight">
                            <span className="font-mono">{subject.subjectCode}</span> · {subject.subjectName}
                        </h1>
                        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
                            {subject.subjectDescription || 'No subject description has been recorded.'}
                        </p>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        {subject.offerings.length} offering{subject.offerings.length === 1 ? '' : 's'}
                    </p>
                </div>
            </header>

            <section aria-labelledby="subject-offerings-heading">
                <div className="mb-3">
                    <h2 id="subject-offerings-heading" className="font-heading text-lg font-semibold">
                        Offerings
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {canOpenOfferings
                            ? 'Each offering is this subject delivered in one study term. Open one to continue to assessments and student work.'
                            : 'Each offering is this subject delivered in one study term. Your current role can inspect the subject, but not open offering details.'}
                    </p>
                </div>

                {subject.offerings.length === 0 ? (
                    <div className="border-y py-10 text-center">
                        <p className="font-medium">This subject has not been offered yet.</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Create an offering from the institution Offerings page when a study term is ready.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden border-y">
                        {subject.offerings.map((offering) => {
                            const content = (
                                <>
                                    <span className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-md">
                                        <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium">
                                            {offering.term.year} · Session {offering.term.session}
                                        </span>
                                        <span className="text-muted-foreground mt-0.5 block text-xs">
                                            {offering._count.assessments} assessment{offering._count.assessments === 1 ? '' : 's'} · {offering._count.scopeAssignments} access assignment{offering._count.scopeAssignments === 1 ? '' : 's'}
                                        </span>
                                    </span>
                                    {canOpenOfferings ? (
                                        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground size-4" />
                                    ) : null}
                                </>
                            );
                            return canOpenOfferings ? (
                                <Link
                                    key={offering.id}
                                    href={`/navigation/institution/offerings/${offering.id}?${contextQuery}`}
                                    className="hover:bg-muted/35 flex items-center gap-4 border-b px-4 py-4 transition-colors last:border-b-0"
                                >
                                    {content}
                                </Link>
                            ) : (
                                <div key={offering.id} className="flex items-center gap-4 border-b px-4 py-4 last:border-b-0">
                                    {content}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}
