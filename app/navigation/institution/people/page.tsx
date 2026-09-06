import { redirect } from 'next/navigation';

import { PeopleSection } from '@/components/admin/people/people-section';
import { listAuthorizedContextOptions } from '@/lib/auth/authorization-service';
import { hasAnyPermission, hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session/service';
import { CHIEF_MANAGEMENT_ROLE_CODE } from '@/lib/auth/delegation-policy';
import { CONTEXT_PARAM, roleSearchParams } from '@/lib/context/context-params';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PEOPLE_ACTIONS = [
    PERMISSION_CODE.MEMBER_VIEW,
    PERMISSION_CODE.ROLE_ASSIGNMENT_VIEW,
    PERMISSION_CODE.ROLE_ASSIGNMENT_CREATE,
    PERMISSION_CODE.ROLE_ASSIGNMENT_REVOKE,
    PERMISSION_CODE.SCOPE_ASSIGNMENT_VIEW,
    PERMISSION_CODE.SCOPE_ASSIGNMENT_CREATE,
    PERMISSION_CODE.SCOPE_ASSIGNMENT_REVOKE,
] as const;

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export default async function InstitutionPeoplePage({
    searchParams,
}: PageProps<'/navigation/institution/people'>) {
    const query = await searchParams;
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const contexts = await listAuthorizedContextOptions(session.user.id);
    const institutionId = first(query[CONTEXT_PARAM.institution]);
    const roleId = first(query[CONTEXT_PARAM.role]);
    const suppliedContext = Boolean(institutionId || roleId);
    const active =
        institutionId && roleId
            ? contexts.find(
                  (context) =>
                      context.institution.id === institutionId && context.role.id === roleId,
              )
            : suppliedContext
              ? undefined
              : contexts.find((context) => hasAnyPermission(context.permissions, PEOPLE_ACTIONS));

    if (!active || !hasAnyPermission(active.permissions, PEOPLE_ACTIONS)) {
        redirect('/navigation/dashboard');
    }

    const contextQuery = new URLSearchParams(roleSearchParams(active)).toString();
    if (!suppliedContext) redirect(`/navigation/institution/people?${contextQuery}`);

    const institutionWide = active.role.scopeType === 'INSTITUTION';
    const allowedOfferingIds = institutionWide
        ? null
        : contexts
              .filter(
                  (context) =>
                      context.assignmentId === active.assignmentId && context.offering !== null,
              )
              .map((context) => context.offering!.id);
    const mayViewPeople = hasPermission(active.permissions, PERMISSION_CODE.MEMBER_VIEW);
    const actingRole = await db.role.findUnique({
        where: { id: active.role.id },
        select: { roleCode: true },
    });

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <header className="mb-6 border-b pb-5">
                <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    Institution workspace
                </p>
                <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">People</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    {institutionWide
                        ? `Review role assignments and access scope at ${active.institution.name}.`
                        : `Review people connected to the offerings covered by ${active.role.roleName}.`}
                </p>
            </header>
            <PeopleSection
                institutionId={active.institution.id}
                searchParams={query}
                endpoint={`/api/institutions/${active.institution.id}/role-assignments`}
                contextQuery={contextQuery}
                allowedOfferingIds={allowedOfferingIds}
                allowProtectedRoles={actingRole?.roleCode === CHIEF_MANAGEMENT_ROLE_CODE}
                roleCapabilities={{
                    create:
                        institutionWide &&
                        hasPermission(active.permissions, PERMISSION_CODE.ROLE_ASSIGNMENT_CREATE),
                    revoke:
                        institutionWide &&
                        hasPermission(active.permissions, PERMISSION_CODE.ROLE_ASSIGNMENT_REVOKE),
                }}
                scopeCapabilities={{
                    view:
                        mayViewPeople ||
                        hasPermission(active.permissions, PERMISSION_CODE.SCOPE_ASSIGNMENT_VIEW),
                    create:
                        institutionWide &&
                        hasPermission(active.permissions, PERMISSION_CODE.SCOPE_ASSIGNMENT_CREATE),
                    revoke:
                        institutionWide &&
                        hasPermission(active.permissions, PERMISSION_CODE.SCOPE_ASSIGNMENT_REVOKE),
                }}
                roleFilterParam="filterRole"
            />
        </main>
    );
}
