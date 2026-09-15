import { describe, expect, it } from 'vitest';

import { takeEventBatch, toolEvent } from './event-recorder';

describe('EasyDraw event batching', () => {
    it('caps a batch at 200 events', () => {
        const queue = Array.from({ length: 250 }, (_, index) => toolEvent('test', { index }));
        expect(takeEventBatch(queue)).toHaveLength(200);
    });

    it('keeps payloads below the API safety margin', () => {
        const queue = Array.from({ length: 30 }, () => toolEvent('test', { text: 'x'.repeat(64 * 1024) }));
        const batch = takeEventBatch(queue);
        expect(batch.length).toBeGreaterThan(0);
        expect(new TextEncoder().encode(JSON.stringify(batch)).byteLength).toBeLessThanOrEqual(900 * 1024);
    });
});
