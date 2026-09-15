import 'server-only';

import type { Prisma } from '@/app/generated/prisma/client';

/**
 * Tự cấp vai trò cho tài khoản vừa tạo, dựa trên email.
 *
 * ─── Ý tưởng ─────────────────────────────────────────────────────────────────
 *
 * Mỗi `Role` có thể mang một `autoGrantEmailRegex`. Khi một người đăng ký, hệ thống dò mọi vai
 * trò có đặt regex và cấp những vai trò có regex khớp email của họ. Nhờ vậy sinh viên dùng email
 * `@students.mq.edu.au` vào là có ngay vai trò Student, không cần ai duyệt.
 *
 * ─── Vì sao dò TẤT CẢ vai trò, không lọc theo cơ sở ─────────────────────────
 *
 * Biểu mẫu đăng ký không hỏi người dùng thuộc cơ sở nào. Chính regex mới là thứ mã hoá cơ sở:
 * `@students\.mq\.edu\.au$` chỉ khớp email Macquarie. Nên dò toàn bộ rồi để regex tự lọc là đúng
 * và đủ; thêm một tham số cơ sở vào đây sẽ là dữ liệu không có nguồn.
 *
 * ─── Vai trò OFFERING được cấp ở trạng thái CHƯA gắn môn ────────────────────
 *
 * `RoleAssignment` không giữ offering — việc gắn vào từng môn nằm ở `ScopeAssignment` riêng. Nên
 * cấp một vai trò cấp OFFERING ở đây tạo ra một assignment CHƯA có scope: người dùng "là Student"
 * nhưng chưa thuộc môn nào. Các quyền cấp offering (`assessment.attempt`, `tool.launch`…) chỉ có
 * hiệu lực sau khi họ được ghi danh vào một offering cụ thể qua mã ghi danh hoặc do người phụ
 * trách gán. Đây là đánh đổi có chủ đích của hướng "dùng lại vai trò offering:student".
 *
 * ─── Vì sao `try/catch` quanh mỗi regex ─────────────────────────────────────
 *
 * Regex do người dùng nhập trong trình quản trị. Schema đã thử biên dịch lúc lưu, nhưng dữ liệu
 * cũ hoặc sửa thẳng vào database có thể lọt một mẫu hỏng. Một regex hỏng KHÔNG được làm sập cả
 * luồng đăng ký — bỏ qua đúng vai trò đó, những vai trò còn lại vẫn xét bình thường.
 *
 * @returns id các vai trò đã cấp, để nơi gọi ghi log nếu cần.
 */
export async function applyAutoGrantedRoles(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string,
): Promise<string[]> {
    const candidates = await tx.role.findMany({
        where: { autoGrantEmailRegex: { not: null } },
        select: { id: true, autoGrantEmailRegex: true },
    });

    const matchedRoleIds: string[] = [];
    for (const role of candidates) {
        if (!role.autoGrantEmailRegex) continue;
        try {
            // Email đã được hạ chữ thường ở `emailSchema` trước khi tới đây, nên regex thường là
            // đủ khớp; không ép cờ `i` để giữ đúng ngữ nghĩa người quản trị đã viết.
            if (new RegExp(role.autoGrantEmailRegex).test(email)) {
                matchedRoleIds.push(role.id);
            }
        } catch {
            // Regex hỏng: bỏ qua vai trò này, không làm hỏng đăng ký.
        }
    }

    if (matchedRoleIds.length > 0) {
        await tx.roleAssignment.createMany({
            // `grantDirectlyById` để trống: đây là hệ thống tự cấp, không phải một người gán.
            data: matchedRoleIds.map((roleId) => ({ userId, roleId })),
        });
    }

    return matchedRoleIds;
}
