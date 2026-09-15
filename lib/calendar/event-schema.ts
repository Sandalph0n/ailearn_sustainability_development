// File này là luật kiểm dữ liệu cho mục lịch cá nhân, dùng chung cho form và route.
import { z } from 'zod';

const isoDate = z.iso.datetime({ offset: true });

export const CalendarEventSchema = z
    .strictObject({
        title: z.string().trim().min(1, { message: 'Give the event a title' }).max(120),
        note: z
            .string()
            .max(2000)
            .nullable()
            .optional()
            .transform((value) => {
                const trimmed = value?.trim() ?? '';
                return trimmed === '' ? null : trimmed;
            }),
        startAt: isoDate,
        endAt: isoDate,
        offeringId: z.uuid().nullable().optional().transform((value) => value ?? null),
    })
    .refine((value) => new Date(value.startAt) < new Date(value.endAt), {
        message: 'The event must end after it starts',
        path: ['endAt'],
    })
    // Một mục lịch dài quá 24 giờ gần như chắc là kéo nhầm; hạn nộp dài hơn thì đã có Gantt.
    .refine(
        (value) => new Date(value.endAt).getTime() - new Date(value.startAt).getTime() <= 24 * 3600 * 1000,
        { message: 'Events are limited to 24 hours', path: ['endAt'] },
    );

export type CalendarEventInput = z.infer<typeof CalendarEventSchema>;

export type CalendarEventDto = {
    id: string;
    title: string;
    note: string | null;
    startAt: string;
    endAt: string;
    offeringId: string | null;
};
