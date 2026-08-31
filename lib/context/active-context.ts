// File này quyết định người dùng đang hành động DƯỚI DANH NGHĨA nào, và đọc điều đó từ URL.
import 'server-only';

import { db } from '@/lib/db';
import { CONTEXT_PARAM, type ContextOption } from '@/lib/context/context-params';

/**
 * ─── URL LÀ LỜI ĐỀ NGHỊ, DATABASE MỚI LÀ SỰ THẬT ─────────────────────────────
 *
 * `?institution=…&role=…` là thứ người dùng gõ được. Ai cũng dán vào đó id của một vai trò họ
 * không hề được cấp. Nên mọi thứ ở đây đi theo một chiều duy nhất: lấy DANH SÁCH vai trò người
 * này thật sự đang giữ từ database trước, rồi mới hỏi "cái URL kia có nằm trong danh sách không".
 *
 * Không bao giờ đi chiều ngược lại — đọc id từ URL rồi truy vấn tiếp — vì lúc đó câu truy vấn
 * đã mang dữ liệu chưa kiểm vào mệnh đề `where`.
 *
 * ─── URL hỏng thì rơi về mặc định, không phải màn hình lỗi ───────────────────
 *
 * Cùng lối với `lib/admin/list-params.ts`. Một liên kết cũ, một vai trò vừa bị thu hồi, một ký
 * tự gõ thiếu — tất cả đều cho ra "ngữ cảnh đầu tiên bạn có", chứ không phải một trang chết.
 * Phía gọi biết được điều đó qua cờ `corrected` để còn nói lại cho người dùng.
 *
 * ─── Tên tham số và kiểu nằm ở `context-params.ts` ───────────────────────────
 *
 * File này import `lib/db`, nên Client Component KHÔNG được chạm vào nó. Xem ghi chú ở file kia.
 */

/**
 * Mọi ngữ cảnh người này được phép hành động, đã sắp xếp để hiển thị.
 *
 * ─── Vì sao lọc `roleRevokedAt: null` ở đây chứ không ở chỗ gọi ─────────────
 *
 * Vai trò bị thu hồi vẫn còn nguyên dòng trong bảng — đó là chủ ý, lịch sử phân quyền phải tra
 * lại được. Nhưng một vai trò đã thu hồi thì KHÔNG còn là ngữ cảnh hành động được nữa. Đặt bộ
 * lọc ở đúng một chỗ để không có đường gọi nào quên nó.
 */
export async function listContextOptions(userId: string): Promise<ContextOption[]> {
    const assignments = await db.roleAssignment.findMany({
        where: { userId, roleRevokedAt: null },
        select: {
            id: true,
            role: {
                select: {
                    id: true,
                    roleName: true,
                    scopeType: true,
                    institution: { select: { id: true, name: true } },
                },
            },
            offering: {
                select: {
                    id: true,
                    subject: { select: { subjectCode: true, subjectName: true } },
                    term: { select: { year: true, session: true } },
                },
            },
        },
        orderBy: [{ role: { institution: { name: 'asc' } } }, { role: { roleName: 'asc' } }],
    });

    return assignments.map((assignment) => ({
        assignmentId: assignment.id,
        institution: assignment.role.institution,
        role: {
            id: assignment.role.id,
            roleName: assignment.role.roleName,
            scopeType: assignment.role.scopeType,
        },
        offering: assignment.offering
            ? {
                  id: assignment.offering.id,
                  subjectCode: assignment.offering.subject.subjectCode,
                  subjectName: assignment.offering.subject.subjectName,
                  year: assignment.offering.term.year,
                  session: assignment.offering.term.session,
              }
            : null,
    }));
}

/** Lấy giá trị đầu — query string lặp khoá được (`?role=a&role=b`) và Next trả về mảng. */
function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export type ResolvedContext = {
    /** `null` khi người này chưa được cấp vai trò nào. */
    active: ContextOption | null;
    options: ContextOption[];
    /** URL không khớp ngữ cảnh nào và đã bị thay bằng mặc định. */
    corrected: boolean;
};

/**
 * Ngữ cảnh đang hoạt động, đọc từ URL rồi đối chiếu với database.
 *
 * ─── Vì sao khớp cả BA tham số chứ không chỉ `role` ─────────────────────────
 *
 * Một người có thể giữ CÙNG một vai trò ở NHIỀU lượt mở môn — "Convenor của COMP1000" và
 * "Convenor của COMP2000" dùng chung một dòng `Role`. Chỉ khớp `role` thì hai ngữ cảnh đó không
 * phân biệt được, và người dùng chọn cái này lại nhận cái kia.
 *
 * `institution` về mặt kỹ thuật suy ra được từ `role`, nhưng vẫn khớp: nó nằm trên URL nên phải
 * đúng, và một URL tự mâu thuẫn thì rơi về mặc định thay vì âm thầm bỏ qua nửa số tham số.
 */
export async function resolveActiveContext(
    userId: string,
    searchParams: Record<string, string | string[] | undefined>,
): Promise<ResolvedContext> {
    const options = await listContextOptions(userId);

    if (options.length === 0) {
        return { active: null, options, corrected: false };
    }

    const wanted = {
        institution: first(searchParams[CONTEXT_PARAM.institution]),
        role: first(searchParams[CONTEXT_PARAM.role]),
        offering: first(searchParams[CONTEXT_PARAM.offering]),
    };

    // Không yêu cầu gì cả thì đây chưa phải URL hỏng — chỉ là chưa chọn. Đừng bật `corrected`,
    // nếu không mọi lần vào trang trần đều kéo theo một lời cảnh báo vô cớ.
    if (!wanted.institution && !wanted.role) {
        return { active: options[0], options, corrected: false };
    }

    const matched = options.find(
        (option) =>
            option.institution.id === wanted.institution &&
            option.role.id === wanted.role &&
            (option.offering?.id ?? undefined) === (wanted.offering || undefined),
    );

    return {
        active: matched ?? options[0],
        options,
        corrected: matched === undefined,
    };
}
