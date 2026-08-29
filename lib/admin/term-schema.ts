// File này định nghĩa luật kiểm dữ liệu cho StudyTerm.
import { z } from 'zod';

import type { StudyTermModel } from '@/app/generated/prisma/models';

export type TermSchemaValue = Pick<StudyTermModel, 'institutionId' | 'year' | 'session'>;

export const TermSchema = z.strictObject({
    institutionId: z.uuid({ message: 'Choose an institution' }),

    /**
     * Chặn trên chặn dưới đặt rộng nhưng KHÔNG bỏ hẳn.
     *
     * Không có chặn thì `year = 20260` gõ nhầm một phím vẫn lọt, và lịch học sẽ có một kỳ nằm ở
     * năm 20260 mà không ai hiểu tại sao. Khoảng 2000–2100 đủ rộng cho mọi dữ liệu thật.
     */
    year: z.coerce
        .number({ message: 'Year is required' })
        .int({ message: 'Year must be a whole number' })
        .min(2000, { message: 'Year must be 2000 or later' })
        .max(2100, { message: 'Year must be 2100 or earlier' }),

    /**
     * Kỳ trong năm. Con số chứ không phải tên, vì mỗi trường gọi một kiểu — "Session 2",
     * "Semester 2", "Trimester 2" — nhưng thứ tự thì ai cũng hiểu như nhau.
     */
    session: z.coerce
        .number({ message: 'Session is required' })
        .int({ message: 'Session must be a whole number' })
        .min(1, { message: 'Session must be 1 or more' })
        .max(12, { message: 'Session must be 12 or less' }),
}) satisfies z.ZodType<TermSchemaValue>;

export type TermFormValue = z.input<typeof TermSchema>;

/**
 * Ô nhập số vẫn giữ CHUỖI, không phải số.
 *
 * `<input>` luôn trả về chuỗi, và đặt `0` làm mặc định thì ô hiện sẵn số 0 mà người dùng phải
 * xoá đi. `z.coerce.number()` lo phần chuyển đổi.
 */
export const EMPTY_TERM_FORM = {
    institutionId: '',
    year: String(new Date().getFullYear()),
    session: '1',
} as unknown as TermFormValue;
