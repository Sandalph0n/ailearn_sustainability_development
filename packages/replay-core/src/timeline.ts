import type { SequencedReplayEvent } from './types';

export type ReplayTimeline = {
    allEvents: readonly SequencedReplayEvent[];
    baselineCount: number;
    events: readonly SequencedReplayEvent[];
    eventIndexes: readonly number[];
    eventSessionIds: readonly string[];
};

export type ReplaySessionEvents = {
    sessionId: string;
    events: readonly SequencedReplayEvent[];
};

/**
 * Separate the workspace bootstrap from recorded user activity.
 *
 * A newly opened tool records `session.started`, then walks the existing workspace and emits
 * snapshot events. Those records describe the state at time zero; playing them one-by-one makes
 * an existing workspace appear to be created by the student during the first second of replay.
 */
export function buildReplayTimeline(
    allEvents: readonly SequencedReplayEvent[],
    sessionId = 'session',
): ReplayTimeline {
    let baselineCount = 0;
    while (baselineCount < allEvents.length && isInitialWorkspaceEvent(allEvents[baselineCount]!)) {
        baselineCount += 1;
    }
    const eventIndexes = allEvents
        .map((item, index) => ({ item, index }))
        .slice(baselineCount)
        // Recorder lifecycle markers carry no workspace state. Browser blur/focus events are also
        // deliberately ignored: opening a menu, DevTools, an OS notification, or the replay UI
        // itself can generate a burst of them without any student activity. Older recordings may
        // still contain those events, so filtering belongs in the reader as well as the recorder.
        .filter(({ item }) => !IGNORED_ACTIVITY_TYPES.has(item.event.type))
        .map(({ index }) => index);
    return {
        allEvents,
        baselineCount,
        events: eventIndexes.map((index) => allEvents[index]!),
        eventIndexes,
        eventSessionIds: eventIndexes.map(() => sessionId),
    };
}

/**
 * Build one attempt-wide stream while keeping every session's launch snapshot as hidden state.
 * The first snapshot is time zero. Later snapshots are applied at their session boundary but do
 * not masquerade as student activity on the public timeline.
 */
export function buildCombinedReplayTimeline(sessions: readonly ReplaySessionEvents[]): ReplayTimeline {
    const allEvents: SequencedReplayEvent[] = [];
    const eventIndexes: number[] = [];
    const eventSessionIds: string[] = [];
    let baselineCount = 0;

    sessions.forEach((session, sessionIndex) => {
        let launchSnapshot = true;
        for (const item of session.events) {
            const allIndex = allEvents.push(item) - 1;
            if (launchSnapshot && isInitialWorkspaceEvent(item)) {
                if (sessionIndex === 0) baselineCount = allEvents.length;
                continue;
            }
            launchSnapshot = false;
            if (IGNORED_ACTIVITY_TYPES.has(item.event.type)) continue;
            eventIndexes.push(allIndex);
            eventSessionIds.push(session.sessionId);
        }
    });

    return {
        allEvents,
        baselineCount,
        events: eventIndexes.map((index) => allEvents[index]!),
        eventIndexes,
        eventSessionIds,
    };
}

const IGNORED_ACTIVITY_TYPES = new Set([
    'session.started',
    'window.focus-restored',
]);

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
