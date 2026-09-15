import { describe, expect, it } from 'vitest';

import type { ReplayEvent, SequencedReplayEvent } from './types';
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
        const allEvents = [
            sequenced('session.started', 0),
            sequenced('folder.snapshot', 1),
            sequenced('file.snapshot', 2),
            sequenced('editor.active', 3),
            sequenced('text.changed', 4),
        ];
        const timeline = buildReplayTimeline(allEvents, 'morning');

        expect(timeline.allEvents).toBe(allEvents);
        expect(timeline.baselineCount).toBe(3);
        expect(timeline.events.map((item) => item.event.type)).toEqual(['editor.active', 'text.changed']);
        expect(timeline.eventIndexes).toEqual([3, 4]);
        expect(timeline.eventSessionIds).toEqual(['morning', 'morning']);
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
        expect(timeline.eventIndexes).toEqual([2, 5]);
        expect(replayCutoff(timeline, 1)).toBe(2);
        expect(replayCutoff(timeline, 2)).toBe(5);
    });

    it('uses an empty baseline when activity starts immediately', () => {
        const timeline = buildReplayTimeline([
            sequenced('editor.active', 0),
            sequenced('text.changed', 1),
        ]);

        expect(timeline.baselineCount).toBe(0);
        expect(replayCutoff(timeline, 0)).toBe(-1);
        expect(timeline.eventIndexes).toEqual([0, 1]);
    });

    it('returns an empty timeline for an empty recording', () => {
        const timeline = buildReplayTimeline([]);

        expect(timeline).toEqual({
            allEvents: [],
            baselineCount: 0,
            events: [],
            eventIndexes: [],
            eventSessionIds: [],
        });
        expect(replayCutoff(timeline, 0)).toBe(-1);
    });
});

describe('buildCombinedReplayTimeline', () => {
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
        expect(timeline.eventIndexes).toEqual([2, 5, 6]);
        expect(timeline.eventSessionIds).toEqual(['morning', 'evening', 'evening']);
        expect(replayCutoff(timeline, 0)).toBe(1);
        expect(replayCutoff(timeline, 1)).toBe(2);
        expect(replayCutoff(timeline, 2)).toBe(5);
        expect(replayCutoff(timeline, 3)).toBe(6);
    });

    it('filters ignored events in every session without losing their hidden stream indexes', () => {
        const timeline = buildCombinedReplayTimeline([
            {
                sessionId: 'first',
                events: [
                    sequenced('session.started', 0),
                    sequenced('window.focus-restored', 1),
                    sequenced('text.changed', 2),
                ],
            },
            {
                sessionId: 'second',
                events: [
                    sequenced('session.started', 0),
                    sequenced('window.focus-restored', 1),
                    sequenced('editor.active', 2),
                ],
            },
        ]);

        expect(timeline.allEvents).toHaveLength(6);
        expect(timeline.eventIndexes).toEqual([2, 5]);
        expect(timeline.eventSessionIds).toEqual(['first', 'second']);
    });

    it('handles empty sessions and an empty session list', () => {
        expect(buildCombinedReplayTimeline([])).toEqual({
            allEvents: [],
            baselineCount: 0,
            events: [],
            eventIndexes: [],
            eventSessionIds: [],
        });

        const timeline = buildCombinedReplayTimeline([
            { sessionId: 'empty', events: [] },
            {
                sessionId: 'active',
                events: [sequenced('text.changed', 0)],
            },
        ]);
        expect(timeline.eventIndexes).toEqual([0]);
        expect(timeline.eventSessionIds).toEqual(['active']);
    });
});

describe('replayCutoff', () => {
    it('clamps positions before the start and after the end', () => {
        const timeline = buildReplayTimeline([
            sequenced('session.started', 0),
            sequenced('file.snapshot', 1),
            sequenced('text.changed', 2),
        ]);

        expect(replayCutoff(timeline, -10)).toBe(1);
        expect(replayCutoff(timeline, 100)).toBe(2);
    });
});
