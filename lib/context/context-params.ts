// File này là phần ngữ cảnh mà CẢ HAI PHÍA dùng chung: tên tham số URL, kiểu, và hai hàm thuần.
import type { PermissionCode } from '@/lib/auth/permissions';

/**
 * ─── VÌ SAO TÁCH KHỎI `active-context.ts` ────────────────────────────────────
 *
 * `active-context.ts` import `lib/db.ts`, tức là Prisma và driver `pg`. Sidebar và bộ chọn vai
 * trò lại là Client Component, và chúng chỉ cần mấy hằng số tên tham số.
 *
 * Gộp chung một file thì bundler đi theo đường import và kéo cả driver Postgres vào gói trình
 * duyệt — hỏng ngay lúc dựng với một loạt `Can't resolve 'fs' / 'net' / 'tls'`, vì `pg` cần
 * module hệ thống của Node mà trình duyệt không có.
 *
 * Ranh giới nằm ở đây: file này KHÔNG được import bất cứ thứ gì chạm database. Thêm một import
 * như vậy là làm vỡ mọi Client Component đang dùng nó.
 */

/** Tên tham số trên URL. Khai một chỗ để trang, sidebar và bộ chuyển đổi không gõ lệch nhau. */
export const CONTEXT_PARAM = {
    institution: 'institution',
    role: 'role',
    offering: 'offering',
} as const;

export type ContextOption = {
    /** `RoleAssignment.id` — định danh thật của một ngữ cảnh. */
    assignmentId: string;
    institution: { id: string; name: string };
    role: { id: string; roleName: string; scopeType: 'INSTITUTION' | 'OFFERING' };
    /** Có với context OFFERING đã scope; null với role INSTITUTION hoặc OFFERING chưa scope. */
    offering: {
        id: string;
        subjectCode: string;
        subjectName: string;
        year: number;
        session: number;
    } | null;
};

/** Context kèm closure quyền hiệu lực, an toàn để truyền từ Server Component xuống client. */
export type AuthorizedContextOption = ContextOption & {
    permissions: PermissionCode[];
};

/** Một assignment OFFERING sinh nhiều context, nên `assignmentId` riêng không còn duy nhất. */
export function contextKey(option: ContextOption): string {
    return `${option.assignmentId}:${option.offering?.id ?? 'no-offering'}`;
}

/** Ba tham số của một ngữ cảnh, dạng đã sẵn sàng ghép vào `URLSearchParams`. */
export function contextSearchParams(option: ContextOption): Record<string, string> {
    const params: Record<string, string> = {
        [CONTEXT_PARAM.institution]: option.institution.id,
        [CONTEXT_PARAM.role]: option.role.id,
    };

    // Vai trò cấp cơ sở KHÔNG mang `offering`. Ghi một chuỗi rỗng vào đó thì URL bẩn mà không
    // thêm nghĩa gì, và phía máy chủ sẽ phải phân biệt "rỗng" với "không có".
    if (option.offering) {
        params[CONTEXT_PARAM.offering] = option.offering.id;
    }

    return params;
}

/** Nhãn ngắn của một ngữ cảnh: `Convenor · COMP1000` hoặc chỉ `Student`. */
export function contextLabel(option: ContextOption): string {
    return option.offering
        ? `${option.role.roleName} · ${option.offering.subjectCode}`
        : option.role.roleName;
}
