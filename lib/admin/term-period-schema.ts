// File này định nghĩa dữ liệu một giai đoạn bên trong StudyTerm.
import { z } from 'zod';

import type { StudyTermPeriodModel } from '@/app/generated/prisma/models';

export type TermPeriodSchemaValue = Pick<
    StudyTermPeriodModel,
    'name' | 'type' | 'startAt' | 'endAt'
>;

/** `datetime-local` gửi chuỗi không múi giờ; trình duyệt và `Date` hiểu nó theo giờ địa phương. */
const localDateTime = z
    .string()
    .trim()
    .min(1, { message: 'Date and time are required' })
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
        message: 'Date and time are invalid',
    })
    .transform((value) => new Date(value));

export const TermPeriodSchema = z
    .strictObject({
        name: z
            .string()
            .trim()
            .min(1, { message: 'Name is required' })
            .max(120, { message: 'Name must not exceed 120 characters' }),
        type: z.enum(['TEACHING', 'BREAK', 'EXAM']),
        startAt: localDateTime,
        endAt: localDateTime,
    })
    .refine((value) => value.startAt < value.endAt, {
        message: 'End must be after start',
        path: ['endAt'],
    }) satisfies z.ZodType<TermPeriodSchemaValue>;

export type TermPeriodFormValue = z.input<typeof TermPeriodSchema>;

export const EMPTY_TERM_PERIOD_FORM: TermPeriodFormValue = {
    name: '',
    type: 'TEACHING',
    startAt: '',
    endAt: '',
};
