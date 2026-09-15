// File này là luật kiểm dữ liệu cho kế hoạch làm bài (khoảng ngày dự định của một người học).
import { z } from 'zod';

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use a YYYY-MM-DD date' });

export const AssessmentPlanSchema = z
    .strictObject({
        startDate: isoDay,
        endDate: isoDay,
    })
    .refine((value) => value.startDate <= value.endDate, {
        message: 'The plan must end on or after the day it starts',
        path: ['endDate'],
    });

export type AssessmentPlanInput = z.infer<typeof AssessmentPlanSchema>;

export type AssessmentPlanDto = {
    assessmentId: string;
    startDate: string;
    endDate: string;
};
