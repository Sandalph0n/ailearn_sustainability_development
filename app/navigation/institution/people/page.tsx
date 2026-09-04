import { PeopleSection } from '@/components/admin/people/people-section';
import { requireInstitutionWorkspace } from '@/lib/auth/institution-workspace';
import { hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { contextSearchParams } from '@/lib/context/context-params';

export const dynamic = 'force-dynamic';

const PEOPLE_ACTIONS = [
    PERMISSION_CODE.MEMBER_VIEW,
    PERMISSION_CODE.ROLE_ASSIGNMENT_MANAGE,
] as const;

export default async function InstitutionPeoplePage({
    searchParams,
}: PageProps<'/navigation/institution/people'>) {
    const query = await searchParams;
    const active = await requireInstitutionWorkspace(query, PEOPLE_ACTIONS);
    const contextQuery = new URLSearchParams(contextSearchParams(active)).toString();

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <header className="mb-6 border-b pb-5">
                <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    Institution workspace
                </p>
                <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">People</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Review role assignments and access scope at {active.institution.name}.
                </p>
            </header>
            <PeopleSection
                institutionId={active.institution.id}
                searchParams={query}
                endpoint={`/api/institutions/${active.institution.id}/role-assignments`}
                contextQuery={contextQuery}
                canManage={hasPermission(
                    active.permissions,
                    PERMISSION_CODE.ROLE_ASSIGNMENT_MANAGE,
                )}
            />
        </main>
    );
}
