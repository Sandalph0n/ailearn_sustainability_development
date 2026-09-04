import { RolesSection } from '@/components/admin/roles/roles-section';
import { requireInstitutionWorkspace } from '@/lib/auth/institution-workspace';
import { hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { contextSearchParams } from '@/lib/context/context-params';

export const dynamic = 'force-dynamic';

const ROLE_ACTIONS = [
    PERMISSION_CODE.ROLE_CREATE,
    PERMISSION_CODE.ROLE_VIEW,
    PERMISSION_CODE.ROLE_UPDATE,
    PERMISSION_CODE.ROLE_DELETE,
] as const;

export default async function InstitutionRolesPage({
    searchParams,
}: PageProps<'/navigation/institution/roles'>) {
    const query = await searchParams;
    const active = await requireInstitutionWorkspace(query, ROLE_ACTIONS);
    const contextQuery = new URLSearchParams(contextSearchParams(active)).toString();
    const capabilities = {
        create: hasPermission(active.permissions, PERMISSION_CODE.ROLE_CREATE),
        view: hasPermission(active.permissions, PERMISSION_CODE.ROLE_VIEW),
        update: hasPermission(active.permissions, PERMISSION_CODE.ROLE_UPDATE),
        delete: hasPermission(active.permissions, PERMISSION_CODE.ROLE_DELETE),
    };

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <header className="mb-6 border-b pb-5">
                <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    Institution workspace
                </p>
                <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">Roles</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Define role scope, inheritance and permissions for {active.institution.name}.
                </p>
            </header>
            <RolesSection
                searchParams={query}
                lockedInstitutionId={active.institution.id}
                endpoint={`/api/institutions/${active.institution.id}/roles`}
                contextQuery={contextQuery}
                capabilities={capabilities}
            />
        </main>
    );
}
