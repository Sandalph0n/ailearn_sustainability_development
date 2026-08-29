// File này định nghĩa luật kiểm dữ liệu cho Role.
import { z } from 'zod';

import type { RoleModel } from '@/app/generated/prisma/models';

export type RoleSchemaValue = Pick<
    RoleModel,
    'institutionId' | 'roleName' | 'scopeType' | 'emailRegex' | 'includedById'
>;

/** Chuỗi rỗng từ ô nhập quy về `null`; cột cho phép NULL còn ô nhập thì không. */
const optionalId = z
    .string()
    .nullable()
    .transform((value) => (value === '' || value === null ? null : value))
    .refine((value) => value === null || z.uuid().safeParse(value).success, {
        message: 'Invalid selection',
    });

export const RoleSchema = z
    .strictObject({
        institutionId: z.uuid({ message: 'Choose an institution' }),

        roleName: z.string().trim().min(1, { message: 'Name is required' }).max(80),

        /**
         * Phạm vi vai trò quyết định `RoleAssignment.offeringId` có ý nghĩa hay không.
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
        emailRegex: z
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

        /** Vai trò này bao gồm vai trò kia — quan hệ tự trỏ, một tầng. */
        includedById: optionalId,
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
    .refine((value) => value.emailRegex === null || value.scopeType === 'INSTITUTION', {
        message: 'Email matching only applies to institution-wide roles',
        path: ['emailRegex'],
    }) satisfies z.ZodType<RoleSchemaValue>;

export type RoleFormValue = z.input<typeof RoleSchema>;

export const EMPTY_ROLE_FORM = {
    institutionId: '',
    roleName: '',
    scopeType: 'OFFERING',
    emailRegex: '',
    includedById: '',
} as unknown as RoleFormValue;
