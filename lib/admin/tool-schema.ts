// File này định nghĩa luật kiểm dữ liệu cho Tool.
import { z } from 'zod';

import type { ToolModel } from '@/app/generated/prisma/models';

export type ToolSchemaValue = Pick<
    ToolModel,
    'code' | 'name' | 'description' | 'codeBaseLocation'
>;

/** Chuỗi tuỳ chọn: ô trống trong biểu mẫu là `''`, mà cột cho phép NULL — quy về `null`. */
const optionalText = (max: number) =>
    z
        .string()
        .max(max)
        .nullable()
        .transform((value) => {
            const trimmed = value?.trim() ?? '';
            return trimmed === '' ? null : trimmed;
        });

export const ToolSchema = z.strictObject({
    /**
     * `code` là khoá thay thế, và nó xuất hiện trong URL của công cụ (`/tools/<code>`).
     *
     * Nên giới hạn chữ thường, số và dấu gạch ngang: đủ để đọc được trong địa chỉ, và không cần
     * mã hoá phần trăm. Chữ hoa bị hạ xuống thay vì báo lỗi — người dùng gõ "Code" thì ý họ rõ ràng.
     */
    code: z
        .string()
        .trim()
        .toLowerCase()
        .min(2, { message: 'Code must be at least 2 characters' })
        .max(40)
        .regex(/^[a-z0-9-]+$/, {
            message: 'Code may only contain lowercase letters, numbers and hyphens',
        }),
    name: z.string().trim().min(1, { message: 'Name is required' }).max(120),
    description: optionalText(500),
    codeBaseLocation: optionalText(500),
}) satisfies z.ZodType<ToolSchemaValue>;

export type ToolFormValue = z.input<typeof ToolSchema>;

export const EMPTY_TOOL_FORM: ToolFormValue = {
    code: '',
    name: '',
    description: '',
    codeBaseLocation: '',
};
