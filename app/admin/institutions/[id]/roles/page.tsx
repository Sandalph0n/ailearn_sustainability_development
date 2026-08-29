import { RolesSection } from '@/components/admin/roles/roles-section';

/**
 * Roles của MỘT cơ sở.
 *
 * Toàn bộ truy vấn và bảng nằm trong `RolesSection`, dùng chung với `/admin/roles`. Trang này chỉ
 * khoá phạm vi lại theo `id` trong đường dẫn.
 */
export const dynamic = 'force-dynamic';

export default async function InstitutionRolesPage({
    params,
    searchParams,
}: PageProps<'/admin/institutions/[id]/roles'>) {
    const { id } = await params;

    return (
        <div className="flex flex-col gap-4 pt-2">
            <p className="text-muted-foreground max-w-2xl text-sm">
                What someone can be at this institution. A role applies institution-wide or to a single offering, and an email rule can grant one automatically.
            </p>

            <RolesSection searchParams={await searchParams} lockedInstitutionId={id} />
        </div>
    );
}
