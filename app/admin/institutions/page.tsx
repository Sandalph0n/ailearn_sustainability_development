import {
    InstitutionsTable,
    type InstitutionListItem,
} from '@/components/admin/institutions/institutions-table';
import { db } from '@/lib/db';

/**
 * Danh sách cơ sở giáo dục.
 *
 * ─── Vì sao đọc database thẳng ở đây, không qua API ─────────────────────────
 *
 * Đây là Server Component — nó đã chạy trên server rồi. Gọi `fetch('/api/...')` từ đây là bắt
 * server tự gửi một request HTTP tới chính nó: thêm một vòng mạng, thêm một lần tuần tự hoá, và
 * thêm một chỗ nữa phải nhớ kiểm quyền.
 *
 * Ghi dữ liệu thì ngược lại, vẫn đi qua `/api/admin/institutions` — nó phát ra từ trình duyệt,
 * nên bắt buộc phải là một endpoint thật.
 *
 * ─── Vì sao `force-dynamic` ──────────────────────────────────────────────────
 *
 * Không có nó, Next thấy trang không đọc gì thay đổi theo request và dựng sẵn một lần lúc build.
 * Sửa dữ liệu xong `router.refresh()` sẽ trả về đúng bản cũ đó.
 */
export const dynamic = 'force-dynamic';

export default async function AdminInstitutionsPage() {
    const rows = await db.institution.findMany({
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            website: true,
            // Đếm ngay trong một truy vấn thay vì gọi `count()` riêng cho từng cơ sở — cách kia
            // là N+1: một trăm cơ sở thành ba trăm lượt hỏi database.
            _count: { select: { subjects: true, studyTerms: true, roles: true } },
        },
    });

    // Đổi `_count` sang hình dạng phẳng hơn để component không phải biết tên quan hệ của Prisma.
    const institutions: InstitutionListItem[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        website: row.website,
        counts: {
            subjects: row._count.subjects,
            terms: row._count.studyTerms,
            roles: row._count.roles,
        },
    }));

    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">Institutions</h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                    Schools and universities using the platform. Every subject, term and role
                    belongs to one of these.
                </p>
            </section>

            <InstitutionsTable institutions={institutions} />
        </div>
    );
}
