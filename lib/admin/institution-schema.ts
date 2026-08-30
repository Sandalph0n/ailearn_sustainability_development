// File này định nghĩa luật kiểm dữ liệu cho Institution, dùng chung cho biểu mẫu và route API.
import { z } from 'zod';

import type { InstitutionModel } from '@/app/generated/prisma/models';

/**
 * Hình dạng dữ liệu một biểu mẫu Institution gửi lên.
 *
 * Dựng từ `Pick<InstitutionModel, …>` để buộc nó đi theo schema Prisma: đổi tên cột thì `Pick`
 * đứt ngay lúc biên dịch, thay vì lặng lẽ gửi lên một trường không còn tồn tại. Cùng lý do và
 * cùng cách làm với `lib/auth/validation/credentials.ts`.
 */
export type InstitutionSchemaValue = Pick<InstitutionModel, 'name' | 'website'>;

/**
 * Website là tuỳ chọn, và biểu mẫu HTML không gửi được `null` — ô trống là chuỗi rỗng.
 *
 * Nên chuỗi rỗng phải được quy về `null` TRƯỚC khi kiểm định dạng URL, nếu không người dùng bỏ
 * trống ô này sẽ bị báo "URL không hợp lệ".
 */
const websiteSchema = z
    .string()
    .trim()
    .max(2048, { message: 'Website must not exceed 2048 characters' })
    .nullable()
    .transform((value) => (value === '' ? null : value))
    .refine(
        (value) => {
            if (value === null || !z.url().safeParse(value).success) return value === null;
            // Link do quản trị viên nhập vẫn được render thành href, nên chỉ cho giao thức web.
            const protocol = new URL(value).protocol;
            return protocol === 'https:' || protocol === 'http:';
        },
        { message: 'Website must be an http:// or https:// URL' },
    );

export const InstitutionSchema = z.strictObject({
    name: z
        .string()
        .trim()
        .min(1, { message: 'Name is required' })
        .max(200, { message: 'Name must not exceed 200 characters' }),
    website: websiteSchema,
}) satisfies z.ZodType<InstitutionSchemaValue>;

/**
 * Giá trị khởi tạo cho biểu mẫu "tạo mới".
 *
 * `website` là chuỗi rỗng chứ không phải `null`: đây là giá trị của Ô NHẬP, mà ô nhập nhận
 * `null` thì React coi là uncontrolled rồi cảnh báo ngay khi người dùng gõ.
 */
export const EMPTY_INSTITUTION_FORM = { name: '', website: '' };

/**
 * Kiểu Ô NHẬP, khác kiểu kết quả.
 *
 * `websiteSchema` có `.transform()` biến chuỗi rỗng thành `null`, nên schema này nhận vào
 * `{ website: string }` mà trả ra `{ website: string | null }`. react-hook-form cần biết cả hai:
 * nó giữ giá trị ô nhập ở kiểu vào, và đưa cho `handleSubmit` kiểu ra.
 */
export type InstitutionFormValue = z.input<typeof InstitutionSchema>;
