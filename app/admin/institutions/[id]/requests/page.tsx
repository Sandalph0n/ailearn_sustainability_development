import Link from 'next/link';

import { RequestsSection } from '@/components/admin/requests/requests-section';
import { ScopeRequestsSection } from '@/components/admin/requests/scope-requests-section';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function InstitutionRequestsPage({
    params,
    searchParams,
}: PageProps<'/admin/institutions/[id]/requests'>) {
    const { id } = await params;
    const query = await searchParams;
    const rawKind = Array.isArray(query.kind) ? query.kind[0] : query.kind;
    const kind = rawKind === 'scope' ? 'scope' : 'role';

    return (
        <div className="flex flex-col gap-4 pt-2">
            <p className="text-muted-foreground max-w-2xl text-sm">
                Review requests for institution membership and subject-level access. Every decision
                remains traceable in the request history.
            </p>

            <nav className="flex w-fit gap-1 rounded-lg border p-1" aria-label="Request type">
                <Link
                    href="?kind=role"
                    aria-current={kind === 'role' ? 'page' : undefined}
                    className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        kind === 'role' && 'bg-muted',
                    )}
                >
                    Role membership
                </Link>
                <Link
                    href="?kind=scope"
                    aria-current={kind === 'scope' ? 'page' : undefined}
                    className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        kind === 'scope' && 'bg-muted',
                    )}
                >
                    Subject access
                </Link>
            </nav>

            {kind === 'scope' ? (
                <ScopeRequestsSection institutionId={id} searchParams={query} />
            ) : (
                <RequestsSection institutionId={id} searchParams={query} />
            )}
        </div>
    );
}
