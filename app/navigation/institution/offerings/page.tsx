import { redirect } from 'next/navigation';

import { OfferingsSection } from '@/components/admin/offerings/offerings-section';
import { listAuthorizedContextOptions } from '@/lib/auth/authorization-service';
import { hasAnyPermission, hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session/service';
import { CONTEXT_PARAM } from '@/lib/context/context-params';

export const dynamic = 'force-dynamic';

const OFFERING_ACTIONS = [
    PERMISSION_CODE.OFFERING_CREATE,
    PERMISSION_CODE.OFFERING_VIEW,
    PERMISSION_CODE.OFFERING_UPDATE,
    PERMISSION_CODE.OFFERING_DELETE,
] as const;

const ASSESSMENT_ACTIONS = [
    PERMISSION_CODE.ASSESSMENT_CREATE,
    PERMISSION_CODE.ASSESSMENT_VIEW,
    PERMISSION_CODE.ASSESSMENT_UPDATE,
    PERMISSION_CODE.ASSESSMENT_DELETE,
] as const;

const PAGE_ACTIONS = [...OFFERING_ACTIONS, ...ASSESSMENT_ACTIONS] as const;

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export default async function InstitutionOfferingsPage({
    searchParams,
}: PageProps<'/navigation/institution/offerings'>) {
    const query = await searchParams;
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const contexts = await listAuthorizedContextOptions(session.user.id);
    const institutionId = first(query[CONTEXT_PARAM.institution]);
    const roleId = first(query[CONTEXT_PARAM.role]);
    const offeringId = first(query[CONTEXT_PARAM.offering]);
    const suppliedContext = Boolean(institutionId || roleId || offeringId);
    const candidates =
        institutionId && roleId
            ? contexts.filter(
                  (context) =>
                      context.institution.id === institutionId && context.role.id === roleId,
              )
            : [];
    const active =
        institutionId && roleId
            ? offeringId
                ? candidates.find((context) => context.offering?.id === offeringId)
                : candidates[0]
            : suppliedContext
              ? undefined
              : contexts.find((context) => hasAnyPermission(context.permissions, PAGE_ACTIONS));

    if (!active || !hasAnyPermission(active.permissions, PAGE_ACTIONS)) {
        redirect('/navigation/dashboard');
    }

    const contextQuery = new URLSearchParams({
        [CONTEXT_PARAM.institution]: active.institution.id,
        [CONTEXT_PARAM.role]: active.role.id,
    }).toString();
    if (!suppliedContext) {
        // Keep the header/sidebar and this page on the same role instead of rendering with an
        // implicit fallback that the user cannot see in the URL.
        redirect(`/navigation/institution/offerings?${contextQuery}`);
    }

    const scopedOfferingIds =
        active.role.scopeType === 'INSTITUTION'
            ? null
            : contexts
                  .filter(
                      (context) =>
                          context.assignmentId === active.assignmentId && context.offering !== null,
                  )
                  .map((context) => context.offering!.id);
    const canManageAssessments = hasAnyPermission(active.permissions, ASSESSMENT_ACTIONS);
    const canOpenOffering =
        hasPermission(active.permissions, PERMISSION_CODE.OFFERING_VIEW) || canManageAssessments;
    const capabilities = {
        // Offering creation is institution-level: an offering-scoped role cannot target a row
        // that does not exist yet. The existing write routes enforce the same boundary.
        create:
            active.role.scopeType === 'INSTITUTION' &&
            hasPermission(active.permissions, PERMISSION_CODE.OFFERING_CREATE),
        view: hasPermission(active.permissions, PERMISSION_CODE.OFFERING_VIEW),
        update:
            hasPermission(active.permissions, PERMISSION_CODE.OFFERING_UPDATE),
        delete:
            hasPermission(active.permissions, PERMISSION_CODE.OFFERING_DELETE),
    };

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <header className="mb-6 border-b pb-5">
                <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    Institution workspace
                </p>
                <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
                    Offerings
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Connect subjects to study terms at {active.institution.name}.
                </p>
            </header>
            <OfferingsSection
                institutionId={active.institution.id}
                searchParams={query}
                endpoint={`/api/institutions/${active.institution.id}/offerings`}
                assessmentBasePath={
                    canOpenOffering ? '/navigation/institution/offerings' : null
                }
                detailActionLabel={canManageAssessments ? 'Manage assessments' : 'View offering'}
                contextQuery={contextQuery}
                capabilities={capabilities}
                allowedOfferingIds={scopedOfferingIds}
                emptyMessage={
                    active.role.scopeType === 'OFFERING'
                        ? 'This role has not been connected to an offering yet.'
                        : undefined
                }
            />
        </main>
    );
}
