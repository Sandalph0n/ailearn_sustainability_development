// File này định nghĩa luật kiểm dữ liệu cho Role.
import { z } from 'zod';

import type { RoleModel } from '@/app/generated/prisma/models';

export type RoleSchemaValue = Pick<
    RoleModel,
    | 'institutionId'
    | 'roleCode'
    | 'roleName'
    | 'scopeType'
    | 'autoGrantEmailRegex'
    | 'requestMode'
> & {
    includedRoleIds: string[];
    permissionIds: string[];
    prerequisiteRoleIds: string[];
};

export const RoleSchema = z
    .strictObject({
        institutionId: z.uuid({ message: 'Choose an institution' }),

        roleCode: z
            .string()
            .trim()
            .toLowerCase()
            .min(1, { message: 'Code is required' })
            .max(100)
            .regex(/^(institution|offering):[a-z0-9]+(?:[._-][a-z0-9]+)*$/, {
                message: 'Use a scope prefix and lowercase segments, e.g. offering:tutor',
            }),

        roleName: z.string().trim().min(1, { message: 'Name is required' }).max(80),

        /**
         * Phạm vi vai trò quyết định assignment có được nối tới offering hay không.
         *
         *   INSTITUTION  áp cho cả trường — quản trị viên khoa, nhân viên học vụ
         *   OFFERING     áp cho một lượt mở môn — sinh viên lớp này, trợ giảng lớp kia
         */
        scopeType: z.enum(['INSTITUTION', 'OFFERING'], { message: 'Choose a scope' }),

        requestMode: z.enum(['DISABLED', 'PUBLIC', 'CONDITIONAL'], {
            message: 'Choose who may request this role',
        }),

        /**
         * Biểu thức khớp email, dùng để tự gán vai trò lúc người dùng gia nhập trường.
         *
         * Kiểm bằng cách THỬ BIÊN DỊCH: một regex hỏng lưu xuống database sẽ làm sập luồng gia
         * nhập sau này, và lúc đó không ai biết nó đến từ đâu.
         */
        autoGrantEmailRegex: z
            .string()
            .max(200)
            .nullable()
            .transform((value) => {
                const trimmed = value?.trim() ?? '';
                return trimmed === '' ? null : trimmed;
            })
            .refine(
                (value) => {
                    if (value === null) return true;
                    try {
                        new RegExp(value);
                        return true;
                    } catch {
                        return false;
                    }
                },
                { message: 'Not a valid regular expression' },
            ),

        /** Các vai trò mà vai trò hiện tại kế thừa quyền. Diamond được phép, chu trình bị cấm. */
        includedRoleIds: z.array(z.uuid({ message: 'Invalid role selection' })).max(100),

        /** Permission là từ vựng toàn hệ thống, role chỉ chọn những quyền đã tồn tại. */
        permissionIds: z.array(z.uuid({ message: 'Invalid permission selection' })).max(200),

        /** Điều kiện OR: người dùng chỉ cần đang giữ một trong các role này. */
        prerequisiteRoleIds: z.array(z.uuid({ message: 'Invalid prerequisite role' })).max(100),
    })
    .superRefine((value, context) => {
        if (new Set(value.includedRoleIds).size !== value.includedRoleIds.length) {
            context.addIssue({
                code: 'custom',
                message: 'A role can only be included once',
                path: ['includedRoleIds'],
            });
        }

        if (new Set(value.permissionIds).size !== value.permissionIds.length) {
            context.addIssue({
                code: 'custom',
                message: 'A permission can only be selected once',
                path: ['permissionIds'],
            });
        }

        if (new Set(value.prerequisiteRoleIds).size !== value.prerequisiteRoleIds.length) {
            context.addIssue({
                code: 'custom',
                message: 'A prerequisite role can only be selected once',
                path: ['prerequisiteRoleIds'],
            });
        }

        if (value.requestMode === 'CONDITIONAL' && value.prerequisiteRoleIds.length === 0) {
            context.addIssue({
                code: 'custom',
                message: 'Choose at least one prerequisite role',
                path: ['prerequisiteRoleIds'],
            });
        }

        if (value.requestMode !== 'CONDITIONAL' && value.prerequisiteRoleIds.length > 0) {
            context.addIssue({
                code: 'custom',
                message: 'Only conditional roles can have prerequisites',
                path: ['prerequisiteRoleIds'],
            });
        }

        const expectedPrefix = value.scopeType === 'INSTITUTION' ? 'institution:' : 'offering:';
        if (!value.roleCode.startsWith(expectedPrefix)) {
            context.addIssue({
                code: 'custom',
                message: `Code must start with ${expectedPrefix}`,
                path: ['roleCode'],
            });
        }
    }) satisfies z.ZodType<RoleSchemaValue>;

/*
 * ─── Vì sao KHÔNG còn giới hạn ánh xạ email theo cấp CƠ SỞ ───────────────────
 *
 * Trước đây có một `.refine` chặn `autoGrantEmailRegex` chỉ cho vai trò INSTITUTION, với lý do:
 * regex chạy lúc đăng ký, khi chưa có lượt mở môn nào để gắn vào.
 *
 * Nay chủ đích đã đổi: cho phép cả vai trò OFFERING mang regex, để email sinh viên tự cấp thẳng
 * vai trò `offering:student`. Assignment sinh ra ở trạng thái CHƯA gắn môn — hợp lệ, vì offering
 * nằm ở `ScopeAssignment` riêng, không phải trên `RoleAssignment`. Quyền cấp offering của vai trò
 * chỉ có hiệu lực sau khi người dùng được ghi danh vào một môn cụ thể. Xem `lib/auth/auto-grant.ts`.
 */

export type RoleFormValue = z.input<typeof RoleSchema>;

export const EMPTY_ROLE_FORM = {
    institutionId: '',
    roleCode: 'offering:',
    roleName: '',
    scopeType: 'OFFERING',
    requestMode: 'DISABLED',
    autoGrantEmailRegex: '',
    includedRoleIds: [],
    permissionIds: [],
    prerequisiteRoleIds: [],
} as unknown as RoleFormValue;
