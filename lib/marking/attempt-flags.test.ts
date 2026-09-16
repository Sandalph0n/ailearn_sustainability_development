import { describe, expect, it } from 'vitest';

import { deriveAttemptFlags } from './attempt-flags';

describe('attempt flag summary', () => {
    it('derives paste, large insert, idle, and clock flags without treating them as verdicts', () => {
        const base = new Date('2026-09-16T00:00:00.000Z');
        const flags = deriveAttemptFlags([
            {
                id: 'session',
                eventBatches: [
                    {
                        seqStart: 0,
                        clientAt: base,
                        receivedAt: new Date(base.getTime() + 6 * 60_000),
                        events: [
                            { type: 'editor.active', at: base.toISOString() },
                            {
                                type: 'editor.paste',
                                at: new Date(base.getTime() + 11 * 60_000).toISOString(),
                                length: 240,
                                lineCount: 12,
                                path: '/main.ts',
                            },
                            {
                                type: 'text.changed',
                                at: new Date(base.getTime() + 12 * 60_000).toISOString(),
                                path: '/main.ts',
                                changes: [{ text: 'x'.repeat(350) }],
                            },
                        ],
                    },
                ],
            },
        ]);

        expect(flags.map(({ kind }) => kind).sort()).toEqual([
            'clock-skew',
            'external-paste',
            'idle-then-bulk',
            'large-insert',
        ]);
        expect(flags.every(({ label }) => !label.toLowerCase().includes('cheat'))).toBe(true);
    });
});
