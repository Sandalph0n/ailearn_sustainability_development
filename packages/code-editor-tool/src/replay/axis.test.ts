import { describe, expect, it } from 'vitest';

import type { ReplayOutlineItem } from './controller';
import {
    axisFraction,
    buildReplayAxis,
    interpolateReplayCursor,
    interpolateReplayFraction,
    nearestReplayPosition,
} from './axis';

function item(at: number, sessionId = 'one'): ReplayOutlineItem {
    return { at, sessionId, notable: false, type: 'text.changed' };
}

describe('replay axis', () => {
    it('keeps active work linear and compresses long gaps logarithmically', () => {
        const minute = 60_000;
        const tenHours = 10 * 60 * minute;
        const week = 7 * 24 * 60 * minute;
        const tenHourAxis = buildReplayAxis([item(0), item(minute), item(minute + tenHours, 'two')], 'time');
        const weekAxis = buildReplayAxis([item(0), item(minute), item(minute + week, 'two')], 'time');

        expect(tenHourAxis.gaps).toHaveLength(1);
        expect(weekAxis.gaps).toHaveLength(1);
        const tenHourWidth = tenHourAxis.gaps[0]!.coordinateEnd - tenHourAxis.gaps[0]!.coordinateStart;
        const weekWidth = weekAxis.gaps[0]!.coordinateEnd - weekAxis.gaps[0]!.coordinateStart;
        expect(weekWidth).toBeGreaterThan(tenHourWidth);
        expect(weekWidth / tenHourWidth).toBeLessThan(2);
        expect(tenHourAxis.playbackDuration - minute).toBeLessThan(20_000);
    });

    it('maps viewport positions back to deterministic event positions', () => {
        const axis = buildReplayAxis([item(0), item(1_000), item(2_000)], 'event');
        expect(axisFraction(axis, 0)).toBe(0);
        expect(axisFraction(axis, 3)).toBe(1);
        expect(nearestReplayPosition(axis, 0)).toBe(0);
        expect(nearestReplayPosition(axis, 1)).toBe(3);
    });

    it('uses even event steps while retaining a visible idle separator', () => {
        const axis = buildReplayAxis([
            item(0),
            item(100),
            item(24 * 60 * 60 * 1_000, 'two'),
        ], 'event');
        expect(axis.gaps).toHaveLength(1);
        expect(axis.points[1]!.coordinate - axis.points[0]!.coordinate).toBe(1);
        expect(axis.points[2]!.coordinate - axis.points[1]!.coordinate).toBeGreaterThan(5);
    });

    it('interpolates a real-time cursor smoothly between events', () => {
        const axis = buildReplayAxis([item(0), item(1_000), item(3_000)], 'time');
        const cursor = interpolateReplayCursor(axis, 2_000);

        expect(cursor.timestamp).toBe(2_000);
        expect(cursor.fraction).toBeCloseTo(2 / 3);
        expect(cursor.fraction).not.toBe(axisFraction(axis, 2));
        expect(cursor.fraction).not.toBe(axisFraction(axis, 3));
    });

    it('moves continuously through a compressed idle gap while preserving wall-clock time', () => {
        const twelveHours = 12 * 60 * 60 * 1_000;
        const axis = buildReplayAxis([item(0), item(1_000), item(1_000 + twelveHours)], 'time');
        const gapStart = axis.points[1]!.playbackAt;
        const gapEnd = axis.points[2]!.playbackAt;
        const cursor = interpolateReplayCursor(axis, gapStart + (gapEnd - gapStart) / 2);

        expect(cursor.timestamp).toBe(1_000 + twelveHours / 2);
        expect(cursor.fraction).toBeGreaterThan(axisFraction(axis, 2));
        expect(cursor.fraction).toBeLessThan(axisFraction(axis, 3));
    });

    it('seeks to an exact time-axis coordinate without snapping to an event', () => {
        const axis = buildReplayAxis([item(0), item(1_000), item(3_000)], 'time');
        const cursor = interpolateReplayFraction(axis, 2 / 3);

        expect(cursor.position).toBe(2);
        expect(cursor.timestamp).toBeCloseTo(2_000);
        expect(cursor.playbackAt).toBeCloseTo(2_000);
        expect(cursor.fraction).toBeCloseTo(2 / 3);
    });

    it('seeks continuously inside a logarithmically compressed idle segment', () => {
        const twelveHours = 12 * 60 * 60 * 1_000;
        const axis = buildReplayAxis([item(0), item(1_000), item(1_000 + twelveHours)], 'time');
        const gap = axis.gaps[0]!;
        const fraction = ((gap.coordinateStart + gap.coordinateEnd) / 2) / axis.total;
        const cursor = interpolateReplayFraction(axis, fraction);

        expect(cursor.position).toBe(2);
        expect(cursor.timestamp).toBeCloseTo(1_000 + twelveHours / 2);
        expect(cursor.fraction).toBeCloseTo(fraction);
    });
});
