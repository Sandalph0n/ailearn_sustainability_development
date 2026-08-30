import { PeopleSection } from '@/components/admin/people/people-section';

export const dynamic = 'force-dynamic';

export default async function InstitutionPeoplePage({
    params,
    searchParams,
}: PageProps<'/admin/institutions/[id]/people'>) {
    const { id } = await params;
    return (
        <div className="flex flex-col gap-4 pt-2">
            <p className="text-muted-foreground max-w-2xl text-sm">
                Grant and revoke institution-wide or offering-specific roles. Revoked assignments
                remain visible as history.
            </p>
            <PeopleSection institutionId={id} searchParams={await searchParams} />
        </div>
    );
}
