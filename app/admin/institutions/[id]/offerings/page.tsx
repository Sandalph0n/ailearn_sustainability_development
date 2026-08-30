import { OfferingsSection } from '@/components/admin/offerings/offerings-section';

export const dynamic = 'force-dynamic';

export default async function InstitutionOfferingsPage({
    params,
    searchParams,
}: PageProps<'/admin/institutions/[id]/offerings'>) {
    const { id } = await params;

    return (
        <div className="flex flex-col gap-4 pt-2">
            <p className="text-muted-foreground max-w-2xl text-sm">
                A subject running in a specific study term. Assessments and offering-scoped roles
                belong here.
            </p>
            <OfferingsSection institutionId={id} searchParams={await searchParams} />
        </div>
    );
}
