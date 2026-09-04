import { OfferingsSection } from '@/components/admin/offerings/offerings-section';
import { requireInstitutionWorkspace } from '@/lib/auth/institution-workspace';
import { hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { contextSearchParams } from '@/lib/context/context-params';

export const dynamic = 'force-dynamic';

const OFFERING_ACTIONS = [
    PERMISSION_CODE.OFFERING_CREATE,
    PERMISSION_CODE.OFFERING_VIEW,
    PERMISSION_CODE.OFFERING_UPDATE,
    PERMISSION_CODE.OFFERING_DELETE,
] as const;

export default async function InstitutionOfferingsPage({
    searchParams,
}: PageProps<'/navigation/institution/offerings'>) {
    const query = await searchParams;
    const active = await requireInstitutionWorkspace(query, OFFERING_ACTIONS);
    const contextQuery = new URLSearchParams(contextSearchParams(active)).toString();
    const capabilities = {
        create: hasPermission(active.permissions, PERMISSION_CODE.OFFERING_CREATE),
        view: hasPermission(active.permissions, PERMISSION_CODE.OFFERING_VIEW),
        update: hasPermission(active.permissions, PERMISSION_CODE.OFFERING_UPDATE),
        delete: hasPermission(active.permissions, PERMISSION_CODE.OFFERING_DELETE),
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
                assessmentBasePath={null}
                contextQuery={contextQuery}
                capabilities={capabilities}
            />
        </main>
    );
}
