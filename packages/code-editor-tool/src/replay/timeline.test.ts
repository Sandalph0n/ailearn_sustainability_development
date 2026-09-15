import { describe, expect, it } from 'vitest';
import type { ReplayEvent, SequencedReplayEvent } from '@lernumi/replay-core';

import { buildCombinedReplayTimeline, buildReplayTimeline, replayCutoff } from './timeline';

const at = '2026-09-15T00:00:00.000Z';

function sequenced(type: string, sequence: number): SequencedReplayEvent {
    return {
        sequence,
        batchId: 'batch',
        clientAt: at,
        receivedAt: at,
        event: { schema: 1, type, at } as ReplayEvent,
    };
}

describe('buildReplayTimeline', () => {
    it('makes the launch snapshot part of time zero', () => {
        const timeline = buildReplayTimeline([
            sequenced('session.started', 0),
            sequenced('folder.snapshot', 1),
            sequenced('file.snapshot', 2),
            sequenced('editor.active', 3),
            sequenced('text.changed', 4),
        ]);

        expect(timeline.baselineCount).toBe(3);
        expect(timeline.events.map((item) => item.event.type)).toEqual(['editor.active', 'text.changed']);
        expect(replayCutoff(timeline, 0)).toBe(2);
        expect(replayCutoff(timeline, 1)).toBe(3);
        expect(replayCutoff(timeline, 2)).toBe(4);
    });

    it('keeps later snapshots but hides recorder restarts and legacy focus noise', () => {
        const timeline = buildReplayTimeline([
            sequenced('session.started', 0),
            sequenced('file.snapshot', 1),
            sequenced('text.changed', 2),
            sequenced('window.focus-restored', 3),
            sequenced('session.started', 4),
            sequenced('file.snapshot', 5),
        ]);

        expect(timeline.baselineCount).toBe(2);
        expect(timeline.events.map((item) => item.sequence)).toEqual([2, 5]);
        expect(replayCutoff(timeline, 1)).toBe(2);
        expect(replayCutoff(timeline, 2)).toBe(5);
    });

    it('combines sessions without exposing their launch snapshots as user activity', () => {
        const timeline = buildCombinedReplayTimeline([
            {
                sessionId: 'morning',
                events: [
                    sequenced('session.started', 0),
                    sequenced('file.snapshot', 1),
                    sequenced('text.changed', 2),
                ],
            },
            {
                sessionId: 'evening',
                events: [
                    sequenced('session.started', 0),
                    sequenced('file.snapshot', 1),
                    sequenced('editor.active', 2),
                    sequenced('text.changed', 3),
                ],
            },
        ]);

        expect(timeline.events.map((item) => item.event.type)).toEqual([
            'text.changed',
            'editor.active',
            'text.changed',
        ]);
        expect(timeline.eventSessionIds).toEqual(['morning', 'evening', 'evening']);
        expect(replayCutoff(timeline, 0)).toBe(1);
        expect(replayCutoff(timeline, 1)).toBe(2);
        expect(replayCutoff(timeline, 2)).toBe(5);
    });
});
