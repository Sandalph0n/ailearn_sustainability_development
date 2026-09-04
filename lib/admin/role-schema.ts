// File này định nghĩa luật kiểm dữ liệu cho Role.
import { z } from 'zod';

import type { RoleModel } from '@/app/generated/prisma/models';

export type RoleSchemaValue = Pick<
    RoleModel,
    'institutionId' | 'roleCode' | 'roleName' | 'scopeType' | 'autoGrantEmailRegex'
> & {
    includedRoleIds: string[];
    permissionIds: string[];
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

        const expectedPrefix = value.scopeType === 'INSTITUTION' ? 'institution:' : 'offering:';
        if (!value.roleCode.startsWith(expectedPrefix)) {
            context.addIssue({
                code: 'custom',
                message: `Code must start with ${expectedPrefix}`,
                path: ['roleCode'],
            });
        }
    })
    /**
     * Luật nghiệp vụ: ánh xạ email chỉ có nghĩa ở cấp CƠ SỞ.
     *
     * Nó chạy lúc người dùng gia nhập một trường, khi chưa có lượt mở môn nào để nói tới. Gắn
     * regex vào vai trò cấp OFFERING là tạo ra một trường không bao giờ được đọc.
     *
     * Prisma không khai được ràng buộc này (`CHECK` phải viết tay vào migration), nên nó sống ở
     * đây — và vì cùng một schema chạy ở cả client lẫn server, luật chỉ viết một lần.
     */
    .refine((value) => value.autoGrantEmailRegex === null || value.scopeType === 'INSTITUTION', {
        message: 'Email matching only applies to institution-wide roles',
        path: ['autoGrantEmailRegex'],
    }) satisfies z.ZodType<RoleSchemaValue>;

export type RoleFormValue = z.input<typeof RoleSchema>;

export const EMPTY_ROLE_FORM = {
    institutionId: '',
    roleCode: 'offering:',
    roleName: '',
    scopeType: 'OFFERING',
    autoGrantEmailRegex: '',
    includedRoleIds: [],
    permissionIds: [],
} as unknown as RoleFormValue;
