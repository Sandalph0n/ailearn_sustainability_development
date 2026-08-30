import { RequestsSection } from '@/components/admin/requests/requests-section';

export const dynamic = 'force-dynamic';

export default async function InstitutionRequestsPage({
    params,
    searchParams,
}: PageProps<'/admin/institutions/[id]/requests'>) {
    const { id } = await params;
    return (
        <div className="flex flex-col gap-4 pt-2">
            <p className="text-muted-foreground max-w-2xl text-sm">
                Review institution-role requests. Approval creates a traceable role assignment;
                rejection keeps the original request as history.
            </p>
            <RequestsSection institutionId={id} searchParams={await searchParams} />
        </div>
    );
}
