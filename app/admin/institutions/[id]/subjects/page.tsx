import { SubjectsSection } from '@/components/admin/subjects/subjects-section';

/**
 * Môn học của MỘT cơ sở.
 *
 * Toàn bộ truy vấn và bảng nằm trong `SubjectsSection`, dùng chung với `/admin/subjects`. Trang
 * này chỉ khoá phạm vi lại theo `id` trong đường dẫn.
 */
export const dynamic = 'force-dynamic';

export default async function InstitutionSubjectsPage({
    params,
    searchParams,
}: PageProps<'/admin/institutions/[id]/subjects'>) {
    const { id } = await params;

    return (
        <div className="flex flex-col gap-4 pt-2">
            <p className="text-muted-foreground max-w-2xl text-sm">
                The units this institution teaches. A subject runs in a term as an offering, and
                assessments hang off that.
            </p>

            <SubjectsSection searchParams={await searchParams} lockedInstitutionId={id} />
        </div>
    );
}
