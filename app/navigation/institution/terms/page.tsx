import { TermsSection } from '@/components/admin/terms/terms-section';
import { requireInstitutionWorkspace } from '@/lib/auth/institution-workspace';
import { hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { contextSearchParams } from '@/lib/context/context-params';

export const dynamic = 'force-dynamic';

const TERM_ACTIONS = [
    PERMISSION_CODE.TERM_CREATE,
    PERMISSION_CODE.TERM_VIEW,
    PERMISSION_CODE.TERM_UPDATE,
    PERMISSION_CODE.TERM_DELETE,
] as const;

export default async function InstitutionTermsPage({
    searchParams,
}: PageProps<'/navigation/institution/terms'>) {
    const query = await searchParams;
    const active = await requireInstitutionWorkspace(query, TERM_ACTIONS);
    const contextQuery = new URLSearchParams(contextSearchParams(active)).toString();
    const capabilities = {
        create: hasPermission(active.permissions, PERMISSION_CODE.TERM_CREATE),
        view: hasPermission(active.permissions, PERMISSION_CODE.TERM_VIEW),
        update: hasPermission(active.permissions, PERMISSION_CODE.TERM_UPDATE),
        delete: hasPermission(active.permissions, PERMISSION_CODE.TERM_DELETE),
    };

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <header className="mb-6 border-b pb-5">
                <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    Institution workspace
                </p>
                <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">Terms</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Maintain study terms and calendar periods for {active.institution.name}.
                </p>
            </header>
            <TermsSection
                searchParams={query}
                lockedInstitutionId={active.institution.id}
                endpoint={`/api/institutions/${active.institution.id}/terms`}
                detailBasePath="/navigation/institution/terms"
                contextQuery={contextQuery}
                capabilities={capabilities}
            />
        </main>
    );
}
