import type { ReplayOutlineItem } from './controller';

export type ReplayAxisMode = 'time' | 'event';

export type ReplayAxisPoint = ReplayOutlineItem & {
    coordinate: number;
    playbackAt: number;
};

export type ReplayIdleGap = {
    afterIndex: number;
    beforeIndex: number;
    from: number;
    to: number;
    durationMs: number;
    coordinateStart: number;
    coordinateEnd: number;
};

export type ReplayAxis = {
    mode: ReplayAxisMode;
    points: readonly ReplayAxisPoint[];
    gaps: readonly ReplayIdleGap[];
    total: number;
    playbackDuration: number;
};

export type ReplayAxisCursor = {
    fraction: number;
    timestamp: number;
};

export type ReplayAxisSeek = ReplayAxisCursor & {
    playbackAt: number;
    position: number;
};

export const REPLAY_IDLE_THRESHOLD_MS = 10 * 60 * 1_000;

/**
 * Produce a non-linear editor axis. Active work remains proportional while long idle periods use
 * a log2 scale, so a ten-hour break is visibly shorter than a week without consuming the track.
 */
export function buildReplayAxis(
    outline: readonly ReplayOutlineItem[],
    mode: ReplayAxisMode,
): ReplayAxis {
    if (outline.length === 0) return { mode, points: [], gaps: [], total: 1, playbackDuration: 0 };

    const points: ReplayAxisPoint[] = [];
    const gaps: ReplayIdleGap[] = [];
    let coordinate = 0;
    let playbackAt = 0;

    outline.forEach((item, index) => {
        if (index > 0) {
            const previous = outline[index - 1]!;
            const durationMs = Math.max(0, item.at - previous.at);
            const idle = durationMs > REPLAY_IDLE_THRESHOLD_MS;
            const start = coordinate;

            if (mode === 'time') {
                coordinate += idle
                    ? compressedIdleSeconds(durationMs)
                    : Math.max(durationMs / 1_000, 0.05);
            } else {
                if (idle) coordinate += compressedIdleEventUnits(durationMs);
                coordinate += 1;
            }

            playbackAt += idle ? compressedIdlePlaybackMs(durationMs) : durationMs;
            if (idle) {
                gaps.push({
                    afterIndex: index - 1,
                    beforeIndex: index,
                    from: previous.at,
                    to: item.at,
                    durationMs,
                    coordinateStart: start,
                    coordinateEnd: coordinate,
                });
            }
        }
        points.push({ ...item, coordinate, playbackAt });
    });

    return {
        mode,
        points,
        gaps,
        total: Math.max(coordinate, 1),
        playbackDuration: playbackAt,
    };
}

export function axisFraction(axis: ReplayAxis, position: number): number {
    if (position <= 0 || axis.points.length === 0) return 0;
    const point = axis.points[Math.min(position, axis.points.length) - 1]!;
    return point.coordinate / axis.total;
}

/**
 * Resolve a continuous playback cursor onto the visual axis and the original wall clock.
 *
 * Event application remains discrete, but real-time playback uses this interpolation on every
 * animation frame. Long idle periods therefore move smoothly across their compressed visual
 * segment while the displayed clock advances through the original elapsed time.
 */
export function interpolateReplayCursor(axis: ReplayAxis, playbackAt: number): ReplayAxisCursor {
    if (axis.points.length === 0) return { fraction: 0, timestamp: 0 };
    const first = axis.points[0]!;
    if (playbackAt <= first.playbackAt || axis.points.length === 1) {
        return { fraction: first.coordinate / axis.total, timestamp: first.at };
    }

    const last = axis.points[axis.points.length - 1]!;
    if (playbackAt >= last.playbackAt) {
        return { fraction: last.coordinate / axis.total, timestamp: last.at };
    }

    let low = 1;
    let high = axis.points.length - 1;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (axis.points[middle]!.playbackAt < playbackAt) low = middle + 1;
        else high = middle;
    }

    const right = axis.points[low]!;
    const left = axis.points[low - 1]!;
    const duration = right.playbackAt - left.playbackAt;
    const progress = duration <= 0 ? 1 : (playbackAt - left.playbackAt) / duration;
    const coordinate = left.coordinate + (right.coordinate - left.coordinate) * progress;
    const timestamp = left.at + (right.at - left.at) * progress;
    return {
        fraction: coordinate / axis.total,
        timestamp,
    };
}

/** Map a visual time-axis coordinate back to an exact playback cursor without snapping. */
export function interpolateReplayFraction(axis: ReplayAxis, fraction: number): ReplayAxisSeek {
    if (axis.points.length === 0) {
        return { fraction: 0, timestamp: 0, playbackAt: 0, position: 0 };
    }

    const boundedFraction = Math.min(1, Math.max(0, fraction));
    const target = boundedFraction * axis.total;
    const first = axis.points[0]!;
    if (target <= first.coordinate) {
        return { fraction: first.coordinate / axis.total, timestamp: first.at, playbackAt: 0, position: 0 };
    }

    let low = 0;
    let high = axis.points.length;
    // Upper bound makes an exact click on a marker include every event sharing that timestamp.
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (axis.points[middle]!.coordinate <= target) low = middle + 1;
        else high = middle;
    }

    const position = low;
    if (position >= axis.points.length) {
        const last = axis.points[axis.points.length - 1]!;
        return {
            fraction: last.coordinate / axis.total,
            timestamp: last.at,
            playbackAt: last.playbackAt,
            position: axis.points.length,
        };
    }

    const left = axis.points[position - 1]!;
    const right = axis.points[position]!;
    const span = right.coordinate - left.coordinate;
    const progress = span <= 0 ? 1 : (target - left.coordinate) / span;
    return {
        fraction: boundedFraction,
        timestamp: left.at + (right.at - left.at) * progress,
        playbackAt: left.playbackAt + (right.playbackAt - left.playbackAt) * progress,
        position,
    };
}

export function nearestReplayPosition(axis: ReplayAxis, fraction: number): number {
    if (axis.points.length === 0 || fraction <= 0) return 0;
    const target = Math.min(1, fraction) * axis.total;
    let low = 0;
    let high = axis.points.length - 1;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (axis.points[middle]!.coordinate < target) low = middle + 1;
        else high = middle;
    }
    const right = axis.points[low]!;
    const left = axis.points[Math.max(0, low - 1)]!;
    const nearest = Math.abs(right.coordinate - target) < Math.abs(left.coordinate - target)
        ? low
        : Math.max(0, low - 1);
    return nearest + 1;
}

function compressedIdleSeconds(durationMs: number): number {
    const thresholdSeconds = REPLAY_IDLE_THRESHOLD_MS / 1_000;
    return thresholdSeconds + Math.log2(durationMs / REPLAY_IDLE_THRESHOLD_MS) * 60;
}

function compressedIdleEventUnits(durationMs: number): number {
    return 4 + Math.log2(durationMs / REPLAY_IDLE_THRESHOLD_MS) * 2;
}

function compressedIdlePlaybackMs(durationMs: number): number {
    return 1_000 + Math.log2(durationMs / REPLAY_IDLE_THRESHOLD_MS) * 700;
}
