import { z } from 'zod';

const ScoreSchema = z.number().finite().min(0).max(1_000_000);
const OutOfSchema = z.number().finite().positive().max(1_000_000);

export const MarkDraftUpdateSchema = z
    .strictObject({
        score: ScoreSchema.nullable().optional(),
        outOf: OutOfSchema.optional(),
        feedback: z.string().max(10_000).optional(),
    })
    .refine(
        (value) =>
            value.score !== undefined ||
            value.outOf !== undefined ||
            value.feedback !== undefined,
        { message: 'Provide a score, scale, or feedback' },
    )
    .refine(
        (value) => value.score === undefined || value.score === null || value.outOf === undefined || value.score <= value.outOf,
        { message: 'Score cannot exceed the maximum mark', path: ['score'] },
    );

export type MarkDraftUpdate = z.infer<typeof MarkDraftUpdateSchema>;
