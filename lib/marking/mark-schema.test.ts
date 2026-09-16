import { describe, expect, it } from 'vitest';

import { MarkDraftUpdateSchema } from './mark-schema';

describe('mark draft update schema', () => {
    it('accepts a partial draft, including clearing its score', () => {
        expect(MarkDraftUpdateSchema.parse({ score: null })).toEqual({ score: null });
        expect(MarkDraftUpdateSchema.parse({ feedback: 'Review the final explanation.' })).toEqual({
            feedback: 'Review the final explanation.',
        });
    });

    it('rejects empty updates', () => {
        expect(MarkDraftUpdateSchema.safeParse({}).success).toBe(false);
    });

    it('rejects scores outside the selected scale', () => {
        expect(MarkDraftUpdateSchema.safeParse({ score: 101, outOf: 100 }).success).toBe(false);
        expect(MarkDraftUpdateSchema.safeParse({ score: -1, outOf: 100 }).success).toBe(false);
        expect(MarkDraftUpdateSchema.safeParse({ score: 1, outOf: 0 }).success).toBe(false);
    });

    it('rejects unknown fields and oversized feedback', () => {
        expect(MarkDraftUpdateSchema.safeParse({ score: 1, privateNote: 'hidden' }).success).toBe(false);
        expect(MarkDraftUpdateSchema.safeParse({ feedback: 'x'.repeat(10_001) }).success).toBe(false);
    });
});
