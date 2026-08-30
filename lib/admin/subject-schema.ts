// File này định nghĩa luật kiểm dữ liệu cho Subject.
import { z } from 'zod';

import type { SubjectModel } from '@/app/generated/prisma/models';

export type SubjectSchemaValue = Pick<
    SubjectModel,
    'institutionId' | 'subjectCode' | 'subjectName' | 'subjectDescription'
>;

export const SubjectSchema = z.strictObject({
    // `uuid()` chứ không phải `string()`: nó đi thẳng vào khoá ngoại, và một chuỗi rác sẽ khiến
    // Postgres ném lỗi cú pháp thay vì "không tìm thấy".
    institutionId: z.uuid({ message: 'Choose an institution' }),

    /**
     * Mã môn viết HOA.
     *
     * Nó là định danh con người dùng để gọi tên môn ("COMP3000"), và unique theo
     * `(institutionId, subjectCode)`. Hạ hay nâng chữ không nhất quán thì "comp3000" và
     * "COMP3000" thành hai môn khác nhau trong cùng một trường.
     */
    subjectCode: z
        .string()
        .trim()
        .toUpperCase()
        .min(2, { message: 'Code must be at least 2 characters' })
        .max(20)
        .regex(/^[A-Z0-9-]+$/, {
            message: 'Code may only contain letters, numbers and hyphens',
        }),

    subjectName: z.string().trim().min(1, { message: 'Name is required' }).max(200),

    subjectDescription: z
        .string()
        .max(1000)
        .nullable()
        .transform((value) => {
            const trimmed = value?.trim() ?? '';
            return trimmed === '' ? null : trimmed;
        }),
}) satisfies z.ZodType<SubjectSchemaValue>;

export type SubjectFormValue = z.input<typeof SubjectSchema>;

export const EMPTY_SUBJECT_FORM: SubjectFormValue = {
    institutionId: '',
    subjectCode: '',
    subjectName: '',
    subjectDescription: '',
};
