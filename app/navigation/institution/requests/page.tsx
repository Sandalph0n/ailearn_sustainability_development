import Link from 'next/link';

import { RequestsSection } from '@/components/admin/requests/requests-section';
import { ScopeRequestsSection } from '@/components/admin/requests/scope-requests-section';
import { ScopeCodesSection } from '@/components/admin/scope-codes/scope-codes-section';
import { buttonVariants } from '@/components/ui/button';
import { requireInstitutionWorkspace } from '@/lib/auth/institution-workspace';
import { hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { contextSearchParams } from '@/lib/context/context-params';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function InstitutionRequestsPage({
    searchParams,
}: PageProps<'/navigation/institution/requests'>) {
    const query = await searchParams;
    const active = await requireInstitutionWorkspace(query, [
        PERMISSION_CODE.ROLE_REQUEST_VIEW,
        PERMISSION_CODE.ROLE_REQUEST_REVIEW,
        PERMISSION_CODE.SCOPE_REQUEST_VIEW,
        PERMISSION_CODE.SCOPE_REQUEST_REVIEW,
        PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_VIEW,
        PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_CREATE,
        PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_REVOKE,
        PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_MANAGE,
    ]);
    const rawKind = Array.isArray(query.kind) ? query.kind[0] : query.kind;
    const canRoleRequests = hasPermission(
        active.permissions,
        PERMISSION_CODE.ROLE_REQUEST_VIEW,
    );
    const canScopeRequests = hasPermission(
        active.permissions,
        PERMISSION_CODE.SCOPE_REQUEST_VIEW,
    );
    const codeCapabilities = {
        view: hasPermission(
            active.permissions,
            PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_VIEW,
        ),
        create: hasPermission(
            active.permissions,
            PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_CREATE,
        ),
        revoke: hasPermission(
            active.permissions,
            PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_REVOKE,
        ),
    };
    const availableKinds = [
        ...(canRoleRequests ? (['role'] as const) : []),
        ...(canScopeRequests ? (['scope'] as const) : []),
        ...(Object.values(codeCapabilities).some(Boolean) ? (['code'] as const) : []),
    ];
    const requestedKind = rawKind === 'scope' || rawKind === 'code' ? rawKind : 'role';
    const kind = availableKinds.includes(requestedKind) ? requestedKind : availableKinds[0];
    const contextParams = contextSearchParams(active);
    const contextQuery = new URLSearchParams(contextParams).toString();
    const roleHref = requestKindHref(contextParams, 'role');
    const scopeHref = requestKindHref(contextParams, 'scope');
    const codeHref = requestKindHref(contextParams, 'code');

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <header className="mb-6 border-b pb-5">
                <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    Institution workspace
                </p>
                <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
                    Access requests
                </h1>
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                    Review role membership and subject access requests for{' '}
                    {active.institution.name}. Every decision remains in the request history.
                </p>
            </header>

            <nav className="mb-4 flex w-fit gap-1 rounded-lg border p-1" aria-label="Request type">
                {canRoleRequests && <Link
                    href={roleHref}
                    aria-current={kind === 'role' ? 'page' : undefined}
                    className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        kind === 'role' && 'bg-muted',
                    )}
                >
                    Role membership
                </Link>}
                {canScopeRequests && <Link
                    href={scopeHref}
                    aria-current={kind === 'scope' ? 'page' : undefined}
                    className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        kind === 'scope' && 'bg-muted',
                    )}
                >
                    Subject access
                </Link>}
                {Object.values(codeCapabilities).some(Boolean) && <Link
                    href={codeHref}
                    aria-current={kind === 'code' ? 'page' : undefined}
                    className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        kind === 'code' && 'bg-muted',
                    )}
                >
                    Access codes
                </Link>}
            </nav>

            {kind === 'code' ? (
                <ScopeCodesSection
                    institutionId={active.institution.id}
                    endpoint={`/api/institutions/${active.institution.id}/scope-codes`}
                    contextQuery={contextQuery}
                    capabilities={codeCapabilities}
                />
            ) : kind === 'scope' ? (
                <ScopeRequestsSection
                    institutionId={active.institution.id}
                    searchParams={query}
                    actionBasePath={`/api/institutions/${active.institution.id}/scope-requests`}
                    contextQuery={contextQuery}
                    roleFilterParam="filterRole"
                    canReview={hasPermission(
                        active.permissions,
                        PERMISSION_CODE.SCOPE_REQUEST_REVIEW,
                    )}
                />
            ) : (
                <RequestsSection
                    institutionId={active.institution.id}
                    searchParams={query}
                    actionBasePath={`/api/institutions/${active.institution.id}/role-requests`}
                    contextQuery={contextQuery}
                    roleFilterParam="filterRole"
                    canReview={hasPermission(
                        active.permissions,
                        PERMISSION_CODE.ROLE_REQUEST_REVIEW,
                    )}
                />
            )}
        </main>
    );
}

function requestKindHref(
    context: Record<string, string>,
    kind: 'role' | 'scope' | 'code',
): string {
    const params = new URLSearchParams(context);
    if (kind !== 'role') params.set('kind', kind);
    return `/navigation/institution/requests?${params.toString()}`;
}
