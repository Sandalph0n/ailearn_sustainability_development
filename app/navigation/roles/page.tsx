import { Shield01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { RoleRequestForm } from '@/components/navigation/role-request-form';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function RoleManagementPage() {
    const institutions = await db.institution.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, website: true },
    });

    return (
        <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center py-10 sm:py-16">
            <section className="bg-card grid min-h-144 w-full overflow-hidden rounded-xl border shadow-sm lg:grid-cols-[minmax(0,0.8fr)_minmax(26rem,1.2fr)]">
                <div className="bg-muted/30 flex flex-col justify-center border-b p-8 sm:p-10 lg:border-r lg:border-b-0">
                    <div className="bg-brand-teal/10 text-brand-teal mb-7 flex size-11 items-center justify-center rounded-lg">
                        <HugeiconsIcon icon={Shield01Icon} strokeWidth={2} className="size-5" />
                    </div>

                    <p className="text-brand-teal mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
                        Account access
                    </p>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                        Role management
                    </h1>
                    <p className="text-muted-foreground mt-3 max-w-md text-sm leading-6">
                        Join the institution where you study or work. Your requested role determines
                        which subjects, offerings and tools you can access. Offering roles may be
                        approved before an administrator connects them to specific offerings.
                    </p>

                    <div className="border-border/70 mt-8 border-t pt-6">
                        <p className="text-sm font-medium">What happens next</p>
                        <ol className="text-muted-foreground mt-4 space-y-3 text-sm">
                            <li className="flex items-center gap-3">
                                <span className="border-brand-teal/30 text-brand-teal flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                                    1
                                </span>
                                Choose an institution and one of its available roles.
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="border-border flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                                    2
                                </span>
                                An institution administrator reviews your request.
                            </li>
                        </ol>
                    </div>
                </div>

                <RoleRequestForm institutions={institutions} />
            </section>
        </main>
    );
}
