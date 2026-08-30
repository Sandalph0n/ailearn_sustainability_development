// File này định nghĩa bài đánh giá và các tool được phép dùng.
import { z } from 'zod';

import type { AssessmentModel } from '@/app/generated/prisma/models';

export type AssessmentSchemaValue = Pick<
    AssessmentModel,
    'name' | 'description' | 'weight' | 'hurdle' | 'isGroup' | 'publishAt' | 'dueAt'
> & { toolIds: string[] };

const optionalText = z
    .string()
    .max(4000, { message: 'Description must not exceed 4000 characters' })
    .nullable()
    .transform((value) => {
        const trimmed = value?.trim() ?? '';
        return trimmed === '' ? null : trimmed;
    });

const requiredLocalDateTime = z
    .string()
    .trim()
    .min(1, { message: 'Due date is required' })
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
        message: 'Date and time are invalid',
    })
    .transform((value) => new Date(value));

const optionalLocalDateTime = z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : new Date(value)))
    .refine((value) => value === null || !Number.isNaN(value.getTime()), {
        message: 'Date and time are invalid',
    });

export const AssessmentSchema = z
    .strictObject({
        name: z.string().trim().min(1, { message: 'Name is required' }).max(200),
        description: optionalText,
        weight: z.coerce
            .number({ message: 'Weight is required' })
            .positive({ message: 'Weight must be greater than 0' })
            .max(100, { message: 'Weight must not exceed 100' }),
        hurdle: z.boolean(),
        isGroup: z.boolean(),
        publishAt: optionalLocalDateTime,
        dueAt: requiredLocalDateTime,
        toolIds: z.array(z.uuid({ message: 'Invalid tool selection' })).max(100),
    })
    .superRefine((value, context) => {
        if (value.publishAt && value.publishAt >= value.dueAt) {
            context.addIssue({
                code: 'custom',
                message: 'Publish date must be before the due date',
                path: ['publishAt'],
            });
        }
        if (new Set(value.toolIds).size !== value.toolIds.length) {
            context.addIssue({
                code: 'custom',
                message: 'A tool can only be selected once',
                path: ['toolIds'],
            });
        }
    }) satisfies z.ZodType<AssessmentSchemaValue>;

export type AssessmentFormValue = z.input<typeof AssessmentSchema>;
export const EMPTY_ASSESSMENT_FORM: AssessmentFormValue = {
    name: '',
    description: '',
    weight: '',
    hurdle: false,
    isGroup: false,
    publishAt: '',
    dueAt: '',
    toolIds: [],
};
