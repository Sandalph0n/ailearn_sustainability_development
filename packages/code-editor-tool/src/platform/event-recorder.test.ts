import { describe, expect, it } from 'vitest';

import { editorEvent, takeEventBatch } from './event-recorder';

describe('event batching', () => {
    it('caps a batch at 200 events', () => {
        const queue = Array.from({ length: 250 }, (_, index) => editorEvent('test', { index }));
        expect(takeEventBatch(queue)).toHaveLength(200);
    });

    it('keeps large payloads below the transport safety margin', () => {
        const queue = Array.from({ length: 30 }, () => editorEvent('test', { text: 'x'.repeat(64 * 1024) }));
        const batch = takeEventBatch(queue);
        expect(batch.length).toBeGreaterThan(0);
        expect(new TextEncoder().encode(JSON.stringify(batch)).byteLength).toBeLessThanOrEqual(900 * 1024);
    });
});
