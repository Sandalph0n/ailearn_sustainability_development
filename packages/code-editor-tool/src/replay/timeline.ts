import type { SequencedReplayEvent } from '@lernumi/replay-core';

export type ReplayTimeline = {
    allEvents: readonly SequencedReplayEvent[];
    baselineCount: number;
    events: readonly SequencedReplayEvent[];
    eventIndexes: readonly number[];
};

/**
 * Separate the workspace bootstrap from recorded user activity.
 *
 * A newly opened tool records `session.started`, then walks the existing workspace and emits
 * snapshot events. Those records describe the state at time zero; playing them one-by-one makes
 * an existing workspace appear to be created by the student during the first second of replay.
 */
export function buildReplayTimeline(allEvents: readonly SequencedReplayEvent[]): ReplayTimeline {
    let baselineCount = 0;
    while (baselineCount < allEvents.length && isInitialWorkspaceEvent(allEvents[baselineCount]!)) {
        baselineCount += 1;
    }
    const eventIndexes = allEvents
        .map((item, index) => ({ item, index }))
        .slice(baselineCount)
        // Reloading the same work session creates another recorder lifecycle marker. It carries no
        // workspace state and must not look like an action performed by the student.
        .filter(({ item }) => item.event.type !== 'session.started')
        .map(({ index }) => index);
    return {
        allEvents,
        baselineCount,
        events: eventIndexes.map((index) => allEvents[index]!),
        eventIndexes,
    };
}

/** Convert a public playhead position into an inclusive index in the complete event stream. */
export function replayCutoff(timeline: ReplayTimeline, position: number): number {
    const bounded = Math.max(0, Math.min(position, timeline.events.length));
    return bounded === 0
        ? timeline.baselineCount - 1
        : timeline.eventIndexes[bounded - 1]!;
}

function isInitialWorkspaceEvent(item: SequencedReplayEvent): boolean {
    return item.event.type === 'session.started'
        || item.event.type === 'folder.snapshot'
        || item.event.type === 'file.snapshot';
}
